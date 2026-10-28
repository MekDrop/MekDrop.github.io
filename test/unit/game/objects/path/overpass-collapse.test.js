import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";
import Ammo from "sync-ammo/dist/ammo.module.js";
import { OverpassDefinitions } from "../../../../../src/game/objects/path/OverpassDefinitions.js";
import { PathOverpassCollider } from "../../../../../src/game/collision/PathOverpassCollider.js";
import { TerrainPhysicsSurface } from "../../../../../src/game/collision/TerrainPhysicsSurface.js";

const sourceUrl = new URL("../../../../../src/game/objects/path/Overpass.js", import.meta.url);
const source = readFileSync(sourceUrl, "utf8")
  .replace('import { OverpassStairs } from "./OverpassStairs.js";', `
    class OverpassStairs {
      static modelUrl = "stairs";
      constructor({root,overpass}) { root.testStairs = overpass.slopeCells; }
      build() { return []; }
    }
  `)
  .replace('import { BridgeRailingKit } from "./BridgeRailingKit.js";', `
    class BridgeRailingKit {
      static modelUrls = ["rail"];
      constructor({root}) { root.testRails = []; this.root = root; }
      addOverpass(layout) { this.root.testRails.push(layout); }
      build() { return []; }
    }
  `)
  .replace('import { TerrainInstanceRenderer } from "../../rendering/terrain/TerrainInstanceRenderer.js";', `
    class TerrainInstanceRenderer {
      constructor({root}) { root.testDeck = this; this.commands = []; }
      addBoxMatrix(...args) { this.commands.push(args); }
      build() {}
      destroy() { this.disposed = true; }
    }
  `)
  .replace('import { OverpassDeckFragment } from "./OverpassDeckFragment.js";', `
    class OverpassDeckFragment {
      constructor({pc,station}) { this.entity = new pc.Entity("Stone fragment "+station); this.entity.fragment = this; this.age=0; }
      get expired() { return this.age>=5; }
      update(dt) { this.age+=dt; }
      destroy() { this.disposed=true; this.entity.destroy(); }
    }
  `)
  .replace('import { WalkingPaths } from "../../navigation/WalkingPaths.js";', `
    class WalkingPaths { static rebuild(map) { map.graphRebuilds=(map.graphRebuilds??0)+1; } }
  `)
  .replace(/from "(\.\.?\/[^\"]+)"/g, (_match, path) => `from "${new URL(path, sourceUrl).href}"`);
const { Overpass } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const fragmentSourceUrl = new URL("../../../../../src/game/objects/path/OverpassDeckFragment.js", import.meta.url);
const fragmentSource = readFileSync(fragmentSourceUrl, "utf8")
  .replace('import { TerrainInstanceRenderer } from "../../rendering/terrain/TerrainInstanceRenderer.js";', `
    class TerrainInstanceRenderer {
      constructor({root}) { root.testDeck=this; this.commands=[]; }
      addBoxMatrix(...args) { this.commands.push(args); }
      build() {}
      destroy() { this.disposed=true; }
    }
  `)
  .replace('import { BridgeRailingKit } from "./BridgeRailingKit.js";', `
    class BridgeRailingKit {
      constructor({root}) { root.testRails=[]; this.root=root; }
      addRailing(rail) { this.root.testRails.push(rail); }
      build() { return []; }
    }
  `);
const { OverpassDeckFragment } = await import(`data:text/javascript;base64,${Buffer.from(fragmentSource).toString("base64")}`);

/**
 * Real Ammo box/compound adapter; it only synchronizes entity transforms.
 * @returns {{world:import("sync-ammo/dist/ammo").btDiscreteDynamicsWorld,root:pc.Entity,Entity:typeof pc.Entity,step:()=>void,destroy:()=>void}}
 */
function sandstonePhysicsWorld() {
  const configuration = new Ammo.btDefaultCollisionConfiguration();
  const dispatcher = new Ammo.btCollisionDispatcher(configuration);
  const broadphase = new Ammo.btDbvtBroadphase();
  const solver = new Ammo.btSequentialImpulseConstraintSolver();
  const world = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, configuration);
  const gravity = new Ammo.btVector3(0, -22, 0);
  world.setGravity(gravity);
  Ammo.destroy(gravity);
  const bodies = new Set();
  class ComponentEntity extends pc.Entity {
    /**
     * @param {string} type
     * @param {Record<string,number|string|pc.Vec3>} options
     */
    addComponent(type, options) {
      if (type !== "rigidbody") {
        this[type] = options;

        return;
      }
      const shape = new Ammo.btCompoundShape();
      const boxes = [];
      const colliders = this.collision.type === "compound" ? this.children : [this];
      for (const collider of colliders) {
        if (collider.collision?.type !== "box") {
          continue;
        }
        const half = collider.collision.halfExtents;
        const size = new Ammo.btVector3(half.x, half.y, half.z);
        const box = new Ammo.btBoxShape(size);
        const local = new Ammo.btTransform();
        local.setIdentity();
        if (collider !== this) {
          const p = collider.getLocalPosition();
          const point = new Ammo.btVector3(p.x, p.y, p.z);
          local.setOrigin(point);
          Ammo.destroy(point);
        }
        shape.addChildShape(local, box);
        boxes.push(box);
        Ammo.destroy(local);
        Ammo.destroy(size);
      }
      const pose = new Ammo.btTransform();
      pose.setIdentity();
      const p = this.getPosition();
      const point = new Ammo.btVector3(p.x, p.y, p.z);
      pose.setOrigin(point);
      Ammo.destroy(point);
      const inertia = new Ammo.btVector3(0, 0, 0);
      const mass = options.mass ?? 0;
      shape.calculateLocalInertia(mass, inertia);
      const motion = new Ammo.btDefaultMotionState(pose);
      const info = new Ammo.btRigidBodyConstructionInfo(mass, motion, shape, inertia);
      const body = new Ammo.btRigidBody(info);
      body.setFriction(options.friction ?? 0.7);
      body.setRestitution(options.restitution ?? 0.01);
      body.setDamping(options.linearDamping ?? 0, options.angularDamping ?? 0);
      world.addRigidBody(body, options.group ?? (mass ? pc.BODYGROUP_DYNAMIC : pc.BODYGROUP_STATIC),
        options.mask ?? pc.BODYMASK_ALL);
      Ammo.destroy(info);
      Ammo.destroy(inertia);
      this.rigidbody = {
        body,
        applyTorqueImpulse: (x, y, z) => {
          const value = new Ammo.btVector3(x, y, z);
          body.applyTorqueImpulse(value);
          Ammo.destroy(value);
        },
        sync: () => {
          motion.getWorldTransform(pose);
          const position = pose.getOrigin();
          const q = pose.getRotation();
          this.setPosition(position.x(), position.y(), position.z());
          this.setRotation(q.x(), q.y(), q.z(), q.w());
        },
        dispose: () => {
          world.removeRigidBody(body);
          Ammo.destroy(body);
          Ammo.destroy(motion);
          Ammo.destroy(pose);
          Ammo.destroy(shape);
          for (const box of boxes) {
            Ammo.destroy(box);
          }
          bodies.delete(this);
        },
      };
      bodies.add(this);
    }

    destroy() {
      this.rigidbody?.dispose();
      this.rigidbody = null;
      super.destroy();
    }
  }
  const root = new ComponentEntity("Real sandstone collapse world");

  return {
    world,
    root,
    Entity: ComponentEntity,
    step: () => {
      world.stepSimulation(1 / 120, 1, 1 / 120);
      for (const entity of bodies) {
        entity.rigidbody.sync();
      }
    },
    destroy: () => {
      for (const entity of [...bodies]) {
        entity.destroy();
      }
      root.destroy();
      Ammo.destroy(world);
      Ammo.destroy(solver);
      Ammo.destroy(broadphase);
      Ammo.destroy(dispatcher);
      Ammo.destroy(configuration);
    },
  };
}

/**
 * @param {boolean} oneSided
 */
function fixture(oneSided = false) {
  const layout = {
    id: "crossing",
    stairApproach: true,
    crossing: {
      col: 5,
      row: 5,
      width: 2,
      depth: 2,
    },
    deckElevation: 2,
    deckThickness: 0.24,
    slopeCells: [{
      col: 5,
      row: 4,
      lowHeight: 1.5,
      highHeight: 2,
      riseDirection: "south",
    }],
    approachCells: [{
      col: 5,
      row: 3,
    }],
    crossingCells: [{
      col: 5,
      row: 5,
    }, {
      col: 6,
      row: 5,
    }, {
      col: 5,
      row: 6,
    }, {
      col: 6,
      row: 6,
    }],
  };
  if (!oneSided) {
    layout.slopeCells.push({
      col: 5,
      row: 7,
      lowHeight: 1.5,
      highHeight: 2,
      riseDirection: "north",
    });
    layout.approachCells.push({
      col: 5,
      row: 8,
    });
  }
  const definition = {
    id: "raised",
    object: "Overpass",
    layout,
  };
  const map = {
    cols: 12,
    rows: 12,
    objects: [definition],
    overpassData: layout,
    grid: Array.from({ length: 12 }, () => Array(12).fill(2)),
    heightmap: Array.from({ length: 12 }, () => Array(12).fill(0)),
    tileMeta: Array.from({ length: 12 }, () => Array.from({ length: 12 }, () => ({}))),
    renderCommands: [
      {
        method: "addBoxMatrix",
        args: ["path", "sandstone", 0, 1.88, -0.5, 0, 2, 0.24, 1, "surfaceOnly", "none"],
      },
      {
        method: "addBoxMatrix",
        args: ["path", "sandstone", 0, 1.88, 0.5, 0, 2, 0.24, 1, "surfaceOnly", "none"],
      },
      {
        method: "addBoxMatrix",
        args: ["path", "sandstone", 0, 1.88, 0, 0, 2, 0.24, 2, "bridgeVerticalSidesOnly", "wood"],
      },
      {
        method: "addOverpass",
        args: [layout, "wood"],
      },
      {
        method: "addBoxMatrix",
        args: ["path", "earth", 0, -0.12, 0, 0, 2, 0.24, 2],
      },
    ],
  };
  for (const { col, row } of layout.crossingCells) {
    map.tileMeta[row][col].overpass = {
      elevation: 2,
      direction: "vertical",
    };
  }
  OverpassDefinitions.populate(map);
  const events = [];
  const colliders = [];
  const owner = new Overpass({
    pc,
    app: {
      fire: (name, payload) => events.push({
        name,
        payload,
      }),
    },
    modelLibrary: {},
    definition,
    runtime: {
      mapData: map,
      materials: new Map(),
      collisionWorld: { add: (collider) => colliders.push(collider) },
    },
  });

  return {
    owner,
    map,
    layout,
    definition,
    events,
    colliders,
  };
}

it("transfers only the raised deck and railings into the Overpass owner, preserving the lower path", () => {
  const { owner, map, definition } = fixture();
  assert.equal(definition.deckCommands.length, 3);
  assert.equal(definition.railingMaterial, "wood");
  assert.equal(map.renderCommands.length, 1);
  assert.equal(map.renderCommands[0].args[3], -0.12);
  const intact = owner.entity.children.find((child) => child.testDeck);
  assert.deepEqual(intact.testDeck.commands, definition.deckCommands.map((command) => command.args));
  OverpassDefinitions.populate(map);
  assert.equal(definition.deckCommands.length, 3);
  assert.equal(map.renderCommands.length, 1);
  owner.destroy();
});

it("accepts the ordinary hammer interaction only from the raised deck or its upper approach", () => {
  const { owner } = fixture();
  const hero = {
    position: new pc.Vec3(0, 2, -1.5),
    facingDirection: new pc.Vec3(0, 0, 1),
    grounded: true,
    smashBridge: ({ onImpact }) => {
      onImpact();

      return true;
    },
  };
  assert.equal(owner.targetStation(hero), 5);
  hero.position.y = 0;
  assert.equal(owner.findInteraction({ hero }), null, "lower route cannot strike the raised crossing");
  hero.position.y = 2;
  const interaction = owner.findInteraction({ hero });
  assert.equal(interaction.canInteract, true);
  assert.equal(interaction.interact(), true);
  assert.equal(owner.definition.layout.collapsed, true);
  owner.destroy();
});

for (const oneSided of [false, true]) {
  it(`removes the central upper crossing while retaining ${oneSided ? "one-sided" : "both"} stair approaches`, () => {
    const { owner, map, layout, events, colliders } = fixture(oneSided);
    const stairs = owner.entity.testStairs;
    const beforeHeights = structuredClone(map.heightmap);
    assert.equal(colliders[0].surfaceHeightAt(0, 0), 2);
    assert.equal(owner.collapseStation(5), true);
    assert.equal(owner.collapseStation(6), false);
    assert.equal(layout.collapsed, true);
    assert.equal(owner.entity.testStairs, stairs);
    assert.deepEqual(map.heightmap, beforeHeights);
    for (const cell of layout.crossingCells) {
      const metadata = map.tileMeta[cell.row][cell.col];
      assert.equal(metadata.overpassCollapsed, true);
      assert.equal(metadata.overpass.elevation, 2);
      assert.equal(metadata.bridgeCollapsed, undefined);
    }
    assert.equal(map.tileMeta[4][5].overpassCollapsed, undefined);
    assert.equal(colliders[0].surfaceHeightAt(0, 0), null);
    assert.equal(colliders[0].ceilingHeightAt(0, 0), null);
    assert.equal(colliders[0].blocksMovementAt(0, 0, 0, 1.9, 0.1), false);
    assert.deepEqual(events.map((event) => event.name), ["bridge:collapsing", "bridge:collapsed"]);
    assert.equal(events[0].payload.elevation, 2);
    assert.equal(map.graphRebuilds, 1);
    const remains = owner.entity.children.find((child) => child.testRails);
    assert.equal(remains.testRails.length, oneSided ? 1 : 2);
    for (const approach of remains.testRails) {
      assert.equal(approach.crossingCells.length, 0);
    }
    const fragments = owner.entity.children.filter((child) => child.fragment).map((child) => child.fragment);
    assert.equal(fragments.length, 2);
    owner.onFrame(5);
    assert.equal(fragments.every((fragment) => fragment.disposed), true);
    owner.destroy();
  });
}

it("disposal disables the collision provider even before the collision world is cleared", () => {
  const { owner, layout } = fixture();
  const collider = new PathOverpassCollider({
    overpass: layout,
    cols: 12,
    rows: 12,
  });
  assert.equal(collider.surfaceHeightAt(0, 0), 2);
  collider.destroy();
  assert.equal(collider.surfaceHeightAt(0, 0), null);
  owner.destroy();
});

it("refresh removes the upper Ammo mesh deck while preserving the untouched lower terrain", () => {
  const { owner, map } = fixture();
  let mesh;
  class ComponentEntity extends pc.Entity {
    addComponent(type, component) {
      this[type] = component;
    }
    removeComponent(type) {
      delete this[type];
    }
  }
  const surface = new TerrainPhysicsSurface({
    pc: {
      Entity: ComponentEntity,
      GraphNode: pc.GraphNode,
      Mesh: class {
        constructor() {
          mesh = this;
        }
        setPositions(positions) {
          this.positions = positions;
        }
        setIndices(indices) {
          this.indices = indices;
        }
        update() {}
        destroy() {}
      },
      StandardMaterial: class {
        update() {} destroy() {}
      },
      MeshInstance: class {},
      Model: class {},
    },
    app: { graphicsDevice: {} },
    mapData: map,
    collisionWorld: null,
  });
  const upper = () => mesh.positions.filter((_value, index) => index % 3 === 1 && mesh.positions[index] === 2).length;
  const lower = () => mesh.positions.filter((_value, index) => index % 3 === 1 && mesh.positions[index] === 0).length;
  assert.ok(upper() > 0);
  const lowerVertices = lower();
  owner.collapseStation(5);
  surface.refresh();
  assert.equal(upper(), 0);
  assert.equal(lower(), lowerVertices);
  surface.destroy();
  owner.destroy();
});

it("falling rows retain the sandstone artwork, live rider collision, and owned fade materials", () => {
  const { owner, definition, map } = fixture();
  class ComponentEntity extends pc.Entity {
    addComponent(type, options) {
      this[type] = type === "rigidbody" ? {
        ...options,
        applyTorqueImpulse: () => {},
      } : options;
    }
  }
  const root = new ComponentEntity("Live world");
  const fragment = new OverpassDeckFragment({
    pc: {
      ...pc,
      Entity: ComponentEntity,
    },
    app: { root },
    modelLibrary: {},
    definition,
    runtime: {
      mapData: map,
      materials: new Map(),
    },
    station: 5,
  });
  assert.equal(fragment.entity.testDeck.commands[0][0], "path");
  assert.equal(fragment.entity.testDeck.commands[0][1], "sandstone");
  assert.ok(fragment.entity.rigidbody.mask & pc.BODYGROUP_DYNAMIC);
  assert.equal(fragment.entity.rigidbody.type, "dynamic");
  assert.equal(fragment.entity.findByTag("hero-support-surface").length, 1);
  const half = fragment.entity.findByTag("hero-support-surface")[0].collision.halfExtents;
  assert.ok(half.x < definition.layout.crossing.width / 2);
  assert.ok(half.z < 0.5);
  assert.equal(half.y, definition.layout.deckThickness / 2);
  assert.equal(fragment.entity.testDeck.commands[0][6], definition.layout.crossing.width);
  assert.equal(fragment.entity.testDeck.commands[0][8], 1);
  assert.equal(fragment.entity.testRails.length, 2);
  const original = new pc.StandardMaterial();
  const instance = { material: original };
  fragment.entity.findComponents = () => [{ meshInstances: [instance] }];
  fragment.update(4);
  assert.notEqual(instance.material, original);
  assert.equal(original.opacity, 1);
  assert.ok(instance.material.opacity < 1);
  fragment.update(1);
  assert.equal(fragment.expired, true);
  fragment.destroy();
  original.destroy();
  root.destroy();
  owner.destroy();
});

it("tilted sandstone rows clear their original-width opening and settle without repeated lip contacts", () => {
  const previousAmmo = globalThis.Ammo;
  globalThis.Ammo = Ammo;
  const environment = sandstonePhysicsWorld();
  const { owner, definition, map } = fixture();
  const fragments = [];
  /**
   * @param {string} name
   * @param {pc.Vec3} position
   * @param {pc.Vec3} halfExtents
   */
  const staticBox = (name, position, halfExtents) => {
    const entity = new environment.Entity(name);
    entity.setPosition(position);
    environment.root.addChild(entity);
    entity.addComponent("collision", {
      type: "box",
      halfExtents,
    });
    entity.addComponent("rigidbody", {
      type: "static",
      mass: 0,
    });
  };
  try {
    staticBox("Lower path", new pc.Vec3(0, -0.25, 0), new pc.Vec3(4, 0.25, 4));
    staticBox("West sidewall", new pc.Vec3(-1.5, 1, 0), new pc.Vec3(0.5, 1, 3));
    staticBox("East sidewall", new pc.Vec3(1.5, 1, 0), new pc.Vec3(0.5, 1, 3));
    staticBox("North stair lip", new pc.Vec3(0, 1, -1.5), new pc.Vec3(1, 1, 0.5));
    staticBox("South stair lip", new pc.Vec3(0, 1, 1.5), new pc.Vec3(1, 1, 0.5));
    for (const station of [5, 6]) {
      const fragment = new OverpassDeckFragment({
        pc: {
          ...pc,
          Entity: environment.Entity,
        },
        app: { root: environment.root },
        modelLibrary: {},
        definition,
        runtime: {
          mapData: map,
          materials: new Map(),
        },
        station,
      });
      const body = fragment.entity.rigidbody.body;
      const pose = body.getCenterOfMassTransform();
      const rotation = new pc.Quat().setFromEulerAngles(station === 5 ? 5 : -5, 0.5, 1);
      const quaternion = new Ammo.btQuaternion(rotation.x, rotation.y, rotation.z, rotation.w);
      pose.setRotation(quaternion);
      body.setWorldTransform(pose);
      body.getMotionState().setWorldTransform(pose);
      Ammo.destroy(quaternion);
      fragments.push(fragment);
    }
    const descent = fragments.map(() => []);
    for (let frame = 0; frame < 360; frame++) {
      environment.step();
      for (const [index, fragment] of fragments.entries()) {
        descent[index].push(fragment.entity.getPosition().y);
      }
    }
    for (const [index, fragment] of fragments.entries()) {
      assert.ok(descent[index][60] < 0.4, `row ${index} stuck above lower path: ${descent[index][60]}`);
      const tail = descent[index].slice(240);
      assert.ok(Math.max(...tail) - Math.min(...tail) < 0.015, `row ${index} keeps twitching after landing`);
      assert.ok(Math.abs(fragment.entity.getPosition().y - 0.12) < 0.02,
        `row ${index} settled at ${fragment.entity.getPosition().y}`);
      const velocity = fragment.entity.rigidbody.body.getLinearVelocity();
      assert.ok(Math.hypot(velocity.x(), velocity.y(), velocity.z()) < 0.03);
    }
  } finally {
    for (const fragment of fragments) {
      fragment.destroy();
    }
    owner.destroy();
    environment.destroy();
    globalThis.Ammo = previousAmmo;
  }
});

it("stone rows dissipate impact motion and settle on the character terrain's zero-friction floor", () => {
  const previousAmmo = globalThis.Ammo;
  globalThis.Ammo = Ammo;
  const environment = sandstonePhysicsWorld();
  const { owner, definition, map } = fixture();
  const floor = new environment.Entity("Zero-friction character terrain");
  floor.setPosition(0, -0.25, 0);
  environment.root.addChild(floor);
  floor.addComponent("collision", {
    type: "box",
    halfExtents: new pc.Vec3(20, 0.25, 20),
  });
  floor.addComponent("rigidbody", {
    type: "static",
    mass: 0,
    friction: 0,
  });
  const fragment = new OverpassDeckFragment({
    pc: {
      ...pc,
      Entity: environment.Entity,
    },
    app: { root: environment.root },
    modelLibrary: {},
    definition,
    runtime: {
      mapData: map,
      materials: new Map(),
    },
    station: 5,
  });
  try {
    const body = fragment.entity.rigidbody.body;
    // A genuine native impulse leaves tangential energy that a frictionless
    // floor cannot remove. Production stone-body damping must dissipate it.
    const impulse = new Ammo.btVector3(36, 0, 6);
    body.applyCentralImpulse(impulse);
    Ammo.destroy(impulse);
    const tail = [];
    for (let frame = 0; frame < 480; frame++) {
      environment.step();
      if (frame >= 360) {
        tail.push(fragment.entity.getPosition().y);
      }
    }
    const velocity = body.getLinearVelocity();
    const angular = body.getAngularVelocity();
    assert.ok(Math.hypot(velocity.x(), velocity.y(), velocity.z()) < 0.03,
      `stone still sliding: ${velocity.x()},${velocity.y()},${velocity.z()}`);
    assert.ok(Math.hypot(angular.x(), angular.y(), angular.z()) < 0.03);
    assert.ok(Math.max(...tail) - Math.min(...tail) < 0.002);
    assert.ok(Math.abs(fragment.entity.getPosition().y - 0.12) < 0.005);
  } finally {
    fragment.destroy();
    owner.destroy();
    environment.destroy();
    globalThis.Ammo = previousAmmo;
  }
});
