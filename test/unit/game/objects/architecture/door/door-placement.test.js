import Ammo from "sync-ammo/dist/ammo.module.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";
import { Door as SharedDoor } from "../../../../../../src/game/objects/architecture/door/Door.js";
import { NpcDoorAvoidance } from "../../../../../../src/game/objects/shared/NpcDoorAvoidance.js";
import { createDoorCollision } from "../../../../../../src/game/objects/architecture/door/DoorCollision.js";
import { DoorSwingPhysics } from "../../../../../../src/game/objects/architecture/door/DoorSwingPhysics.js";

const source = readFileSync(new URL("../../../../../../src/game/objects/architecture/door/DoorPlacement.js", import.meta.url), "utf8")
  .replace(/^import[^\n]+\r?\n/gm, "");
const Placement = new Function("interiorDoorUrl", "castleDoorsModelUrl", "CASTLE_DOOR_ANIMATION", "createDoorCollision", `${source.replace("export class", "class")}\nreturn DoorPlacement;`)("interior.glb", "doors.glb", {
  OPEN: "open",
  OPEN_WIDE: "wide",
}, createDoorCollision);
function Door(options) {
  return new SharedDoor(Placement.create(options));
}

it("registers the entrance arch surface as an obstacle without filling its opening", () => {
  let margin;
  class Entity extends pc.Entity {
    components = new Map();
    addComponent(type, data) {
      this.components.set(type, data);
      if (type === "collision") {
        this.collision = {
          shape: {
            getNumChildShapes: () => 1,
            getChildShape: () => ({
              setMargin: (value) => {
                margin = value;
              },
            }),
          },
        };
      }
    }
  }
  const mesh = { curvedSurface: true };
  let released = false;
  class MeshInstance {
    constructor(sourceMesh, material, node) {
      Object.assign(this, {
        mesh: sourceMesh,
        material,
        node,
      });
    }
    destroy() {
      released = true;
    }
  }
  const entrance = new Entity("Entrance");
  const arch = new Entity("Entrance masonry interior reveal bridge spandrel 0");
  entrance.addChild(arch);
  entrance.findComponents = () => [{
    entity: arch,
    meshInstances: [{
      mesh,
      material: {},
    }],
  }];
  const collision = createDoorCollision({
    ...pc,
    Entity,
    MeshInstance,
  }, entrance);
  const collider = arch.children[0];
  assert.equal(collider.components.get("rigidbody").type, "static");
  const shape = collider.components.get("collision");
  assert.equal(shape.type, "mesh");
  assert.equal(shape.model.meshInstances[0].mesh, mesh, "preserves the actual arch opening");
  assert.equal(margin, 0.001, "mesh padding stays below the authored hinge clearance");
  assert.deepEqual(collider.getLocalPosition().toArray(), [0, 0, 0]);
  let framePosition;
  collider.rigidbody = {
    syncEntityToBody: () => {
      framePosition = collider.getPosition().clone();
    },
  };
  entrance.setPosition(4, 2, -6);
  collision.syncFrameBodies();
  assert.deepEqual(framePosition.toArray(), [4, 2, -6], "frame follows the attached castle world pose");
  collision.destroy();
  assert.equal(arch.children.length, 0);
  assert.equal(released, true);
});

it("uses curved entrance planks for physics while keeping picking at their authored offset", () => {
  class Entity extends pc.Entity {
    components = new Map();
    addComponent(type, data) {
      this.components.set(type, data);
    }
  }
  const entrance = new Entity("Entrance");
  const leaf = new Entity("Entrance oak plank 0");
  const helper = new Entity("Entrance collision door plank 0");
  entrance.addChild(leaf); entrance.addChild(helper);
  const mesh = {
    getPositions: (out) => {
      out.push(-.9, 0, -.025, -.1, 2, .025);
    },
  };
  const hidden = {
    entity: helper,
    enabled: true,
    meshInstances: [{ mesh }],
  };
  entrance.findComponents = () => [hidden, {
    entity: leaf,
    asset: 123,
    meshInstances: [{ mesh }],
  }];
  const collision = createDoorCollision({
    ...pc,
    Entity,
  }, entrance);
  assert.equal(hidden.enabled, false);
  assert.equal(helper.children.length, 0, "old tall helper boxes no longer restrict the arch");
  assert.deepEqual(leaf.children[0].components.get("collision"), {
    type: "mesh",
    renderAsset: 123,
    convexHull: true,
  });
  assert.deepEqual(leaf.children[0].getLocalPosition().toArray(), [0, 0, 0]);
  let loadedMargin;
  leaf.children[0].collision = {
    shape: {
      getNumChildShapes: () => 1,
      getChildShape: () => ({
        setMargin: (value) => {
          loadedMargin = value;
        },
      }),
    },
  };
  collision.syncFrameBodies();
  assert.equal(loadedMargin, .001, "applies mechanical clearance after the mesh asset loads");
  assert.equal(collision.blocksAt(-.5, 1, 0, .01), true);
  assert.equal(collision.blocksAt(.5, 1, 0, .01), false);
  assert.ok(Math.abs(collision.raycast(new pc.Vec3(-.5, 1, -1), new pc.Vec3(-.5, 1, 1)) - .4875) < 1e-6);
  collision.destroy();
});

/**
 * @param {number} floorY
 * @returns {{door: object, entity: object}}
 */
function upperDoor(floorY = 3, side = "NORTH", main = false, placement = null) {
  class Entity extends pc.Entity {
    addComponent(type) {
      if (type === "anim") {
        this.anim = {
          baseLayer: layer,
          addAnimationState: () => {},
          update: () => {},
        };
      }
    }
  }
  const entity = new Entity("doors");
  const left = new Entity(main ? "Left hinge" : "Right interior door hinge"), right = new Entity("Right hinge");
  left.setLocalPosition(-1, 0, 0); right.setLocalPosition(1, 0, 0);
  entity.addChild(left); if (main) {
    entity.addChild(right);
  }
  const renders = (main ? [left, right] : [left]).map((hinge, index) => {
    const plank = new Entity("Castle door plank"); hinge.addChild(plank);
    const x = index === 0 ? [0, main ? 1 : 2] : [-1, 0];

    return {
      entity: plank,
      meshInstances: [{
        mesh: {
          getPositions: (out) => {
            out.push(x[0], 0, -.05, x[1], 2.275, .05);
          },
        },
      }],
    };
  });
  entity.findComponents = () => renders;
  let wide = false;
  const layer = {
    play: (name) => {
      wide = name === "wide";
    },
    set activeStateCurrentTime(time) {
      left.setLocalEulerAngles(0, (main ? wide ? 179 : 105 : wide ? -179 : -90) * time, 0);
      right.setLocalEulerAngles(0, (wide ? -179 : -105) * time, 0);
    },
  };
  const door = new Door({
    pc: {
      ...pc,
      Entity,
    },
    castlePosition: {
      x: 0,
      z: 0,
      width: 8,
      depth: 8,
      elevation: 0,
    },
    door: {
      side,
      offset: 3,
      width: main ? 2 : 1,
    },
    placement: placement ?? (main ? null : {
      x: 0,
      y: floorY,
      z: 2,
      yaw: 0,
      height: 2,
    }),
    modelLibrary: {
      instantiate: () => entity,
      getAnimationTracks: () => new Map([["open", { duration: 1 }], ["wide", { duration: 1 }]]),
    },
    woodMaterial: {},
  });

  return {
    door,
    entity,
  };
}

it("keeps an upstairs door closed for ground-floor visitors and clear of ground navigation", () => {
  const { door, entity } = upperDoor();
  assert.deepEqual(entity.getLocalScale().toArray(), [0.5, 2 / 2.4, 0.54]);
  door.updateHeroPosition({
    x: 0,
    y: 0,
    z: 2,
  });
  door.update(1);
  assert.equal(door.blocksCameraAt(0, 3.5, 2.155, 0.1), true);
  assert.equal(door.intersectsFootprint(0, 2, 0.1), false);
  assert.equal(door.blocksCameraAt(0, 0.5, 2, 0.1), false);
});

it("keeps both interior casing faces proud of quarter-metre masonry in every orientation", () => {
  for (const yaw of [0, 90, 180, 270]) {
    for (const mirrored of [false, true]) {
      const { entity } = upperDoor(3, "NORTH", false, {
        x: 0,
        y: 3,
        z: 0,
        yaw,
        height: 2,
        mirrored,
        frameOffset: 0.125 - 0.095,
      });
      const transform = entity.getWorldTransform();
      const radians = yaw * Math.PI / 180;
      const normal = new pc.Vec3(Math.sin(radians), 0, Math.cos(radians));
      // Actual GLB casing envelope: -0.31 .. 0.19 along its depth axis.
      const back = transform.transformPoint(new pc.Vec3(0, 0, -0.31)).dot(normal);
      const front = transform.transformPoint(new pc.Vec3(0, 0, 0.19)).dot(normal);
      assert.ok(back < -0.125 - 0.005, `yaw ${yaw}: back casing clears wall`);
      assert.ok(front > 0.125 + 0.005, `yaw ${yaw}: front casing clears wall`);
    }
  }
});

it("lets test controls force a destination and restore automatic proximity behavior", () => {
  const { door } = upperDoor();
  door.updateHeroPosition({
    x: 0,
    y: 3,
    z: 1.5,
  });
  door.testOpenAmount = 0;
  door.update(1);
  assert.equal(door.openAmount, 0);
  door.testOpenAmount = 1;
  door.update(1);
  assert.ok(Math.abs(door.openAmount - 1) < 0.000001);
  door.updateHeroPosition({
    x: 20,
    y: 3,
    z: 20,
  });
  door.testOpenAmount = null;
  door.update(1);
  assert.ok(door.openAmount < 0.000001);
  assert.equal(door.exteriorEntrance, false);
  assert.equal(upperDoor(0, "NORTH", true).door.exteriorEntrance, true);
});

it("lets a direct door click release the test controls' forced-closed state", () => {
  const { door } = upperDoor();
  door.testOpenAmount = 0;
  door.update(0.25);
  assert.equal(door.openAmount, 0);
  assert.equal(door.handlePointerDown(), true);
  door.update(0.25);
  assert.ok(door.openAmount > 0);
  door.update(2);
  assert.ok(door.openAmount < 0.000001, "normal temporary opening expires after the click");
});

it("opens the authored door animation for visitors on the bedroom floor and closes when they leave", () => {
  const { door } = upperDoor();
  door.updateHeroPosition({
    x: 0,
    y: 3,
    z: 1.5,
  });
  door.update(1);
  assert.equal(door.blocksCameraAt(0, 3.5, 2, 0.1), false);
  door.updateHeroPosition({
    x: 0,
    y: 0,
    z: 1.5,
  });
  door.update(1);
  assert.equal(door.blocksCameraAt(0, 3.5, 2.155, 0.1), true);
});
it("keeps a generated ground courtyard doorway solid until its animation opens", () => {
  const { door } = upperDoor(0);
  assert.equal(door.intersectsFootprint(0, 2, 0.18), true);
  door.updateHeroPosition({
    x: 0,
    y: 0,
    z: 1.5,
  });
  door.update(1);
  assert.equal(door.intersectsFootprint(0, 2, 0.18), false);
});
it("collides with an open leaf instead of the empty doorway", () => {
  const { door, entity } = upperDoor(0);
  door.updateHeroPosition({
    x: 0,
    y: 0,
    z: 1.5,
  });
  door.update(1);
  assert.equal(door.blocksCameraAt(0, .5, 2, .1), false);
  const point = entity.children[0].getWorldTransform().transformPoint(new pc.Vec3(.5, .5, 0));
  assert.equal(door.blocksCameraAt(point.x, point.y, point.z, .1), true);
});

it("folds exterior leaves away from the castle walls in every orientation", () => {
  for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
    const { door, entity } = upperDoor(0, side, true);
    door.openTemporarily(2); door.update(1);
    const tip = entity.children[0].getWorldTransform().transformPoint(new pc.Vec3(.8, .5, 0));
    assert.ok(side === "NORTH" ? tip.z < 0 : side === "SOUTH" ? tip.z > 8 :
      side === "WEST" ? tip.x < 0 : tip.x > 8, `${side} door clears the exterior jamb`);
  }
});

it("swings authored inward entrance leaves into the castle in every orientation", () => {
  for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
    const yaw = {
      NORTH: 0,
      SOUTH: 180,
      WEST: 90,
      EAST: -90,
    }[side];
    const { door, entity } = upperDoor(0, side, true,
      {
        x: 4,
        y: 0,
        z: 4,
        yaw,
        height: 2.3,
        arched: true,
        swing: "inward",
      });
    door.openTemporarily(2); door.update(1);
    for (const [index, hinge] of entity.children.entries()) {
      const tip = hinge.getWorldTransform().transformPoint(new pc.Vec3(index === 0 ? .8 : -.8, .5, 0));
      assert.ok(side === "NORTH" ? tip.z > 4 : side === "SOUTH" ? tip.z < 4 :
        side === "WEST" ? tip.x > 4 : tip.x < 4, `${side} leaf ${index} opens inside`);
    }
  }
});

it("keeps every wide-open interior door leaf solid while clearing its aperture", () => {
  const { door, entity } = upperDoor(0, "NORTH", false,
    {
      x: 0,
      y: 0,
      z: 2,
      yaw: 0,
      height: 2,
    });
  door.openTemporarily(2); door.update(1);
  const point = entity.children[0].getWorldTransform().transformPoint(new pc.Vec3(1, .5, 0));
  assert.equal(door.blocksCameraAt(point.x, point.y, point.z, .1), true);
  assert.equal(door.blocksCameraAt(0, .5, 2, .1), false);
});

it("stops an interior swing at a real Ammo wall and resumes when it is removed", () => {
  const previousAmmo = globalThis.Ammo;
  globalThis.Ammo = Ammo;
  const configuration = new Ammo.btDefaultCollisionConfiguration();
  const dispatcher = new Ammo.btCollisionDispatcher(configuration);
  const broadphase = new Ammo.btDbvtBroadphase();
  const solver = new Ammo.btSequentialImpulseConstraintSolver();
  const world = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, configuration);
  const resources = [];
  const { door, entity } = upperDoor(0);
  entity._enabledInHierarchy = true;
  const colliders = entity.findComponents("render").map(render => render.entity.children[0]);
  for (const collider of colliders) {
    collider._enabledInHierarchy = true;
    const extents = new Ammo.btVector3(.5, .95, .025);
    const shape = new Ammo.btBoxShape(extents);
    const nativeBody = new Ammo.btPairCachingGhostObject();
    nativeBody.setCollisionShape(shape);
    world.addCollisionObject(nativeBody, 2, -1);
    collider.rigidbody = {
      system: { dynamicsWorld: world },
      body: nativeBody,
      syncEntityToBody: () => {},
    };
    resources.push(nativeBody, shape, extents);
  }
  const wallExtents = new Ammo.btVector3(2, 2, .05);
  const wallShape = new Ammo.btBoxShape(wallExtents);
  const wall = new Ammo.btPairCachingGhostObject();
  const transform = new Ammo.btTransform();
  transform.setIdentity();
  const position = new Ammo.btVector3(0, 1, 2.75);
  transform.setOrigin(position);
  wall.setCollisionShape(wallShape);
  wall.setCollisionFlags(1);
  wall.setWorldTransform(transform);
  world.addCollisionObject(wall, 1, -1);
  resources.push(wall, wallShape, wallExtents, transform, position);
  const floorExtents = new Ammo.btVector3(3, .1, 3);
  const floorShape = new Ammo.btBoxShape(floorExtents);
  const floor = new Ammo.btPairCachingGhostObject();
  const floorPosition = new Ammo.btVector3(0, -.08, 2);
  transform.setOrigin(floorPosition);
  floor.setCollisionShape(floorShape);
  floor.setCollisionFlags(1);
  floor.setWorldTransform(transform);
  world.addCollisionObject(floor, 1, -1);
  resources.push(floor, floorShape, floorExtents, floorPosition);
  const probe = new DoorSwingPhysics(colliders.map(entity => ({
    entity,
    half: [],
  })));
  try {
    assert.equal(probe.contacts().has(Ammo.getPointer(floor)), false,
      "level floor support does not restrict rotation even with a shallow initial overlap");
    door.openTemporarily(10);
    door.update(1);
    const stopped = Math.abs(entity.children[0].getLocalEulerAngles().y);
    assert.ok(stopped > 20 && stopped < 80, "wall stops the leaf before its full swing");
    door.update(.1);
    assert.ok(Math.abs(Math.abs(entity.children[0].getLocalEulerAngles().y) - stopped) < .01,
      "blocked opening does not creep through the wall");
    world.removeCollisionObject(wall);
    door.update(1);
    assert.ok(Math.abs(entity.children[0].getLocalRotation().w) < .018, "clear door uses the full swing");
    door.update(20);
    assert.ok(Math.abs(entity.children[0].getLocalEulerAngles().y) < .01, "door still closes");
  } finally {
    probe.destroy();
    world.removeCollisionObject(floor);
    world.removeCollisionObject(wall);
    door.destroy();
    for (const collider of colliders) {
      world.removeCollisionObject(collider.rigidbody.body);
    }
    for (const resource of resources) {
      Ammo.destroy(resource);
    }
    for (const resource of [world, solver, broadphase, dispatcher, configuration]) {
      Ammo.destroy(resource);
    }
    globalThis.Ammo = previousAmmo;
  }
});

it("clicks the moving leaf at closed, intermediate and fully open poses", () => {
  const { door, entity } = upperDoor(0);
  const collider = entity.findComponents("render")[0].entity.children[0];
  for (const step of [0, .2, 1]) {
    door.openTemporarily(10); door.update(step);
    const transform = collider.getWorldTransform();
    const start = transform.transformPoint(new pc.Vec3(0, 0, -.5));
    const end = transform.transformPoint(new pc.Vec3(0, 0, .5));
    const hit = door.getPointerHit(start, end);
    assert.equal(hit?.pointerTarget, door, "click follows the leaf rather than the closed doorway");
    assert.ok(hit.distance >= 0 && hit.distance <= 1);
    assert.equal(hit.pointerTarget.handlePointerDown(), true);
  }
  assert.equal(door.getPointerHit(new pc.Vec3(10, 1, 0), new pc.Vec3(10, 1, 4)), null);
});

it("holds a swinging door until a visible NPC clears its leaf", () => {
  const { door, entity } = upperDoor();
  const app = new pc.EventHandler();
  const root = new pc.Entity();
  root._enabledInHierarchy = true;
  root.addChild(entity);
  const npc = new pc.Entity("blocked servant");
  root.addChild(npc);
  npc.setPosition(0, 3, 2.8);
  const behavior = new NpcDoorAvoidance(npc, app);
  try {
    door.npcNavigation = () => false;
    door.openTemporarily(10);
    door.update(1);
    assert.equal(behavior.phase, "wait");
    assert.equal(door.blocksCameraAt(0, 3.6, 2.8, 0.5), false,
      "accepted leaf pose never overlaps the NPC footprint");
    const held = entity.children[0].getLocalRotation().clone();
    door.update(1);
    assert.deepEqual(entity.children[0].getLocalRotation(), held);
    npc.setPosition(10, 3, 10);
    door.update(1);
    assert.notDeepEqual(entity.children[0].getLocalRotation(), held,
      "door resumes once the NPC is clear");
  } finally {
    behavior.destroy(); door.destroy();
  }
});

it("mirrors the interior hinge and animated leaf while keeping collision and picking aligned", () => {
  for (const yaw of [0, 90, 180, -90]) {
    const placement = {
      x: 0,
      y: 0,
      z: 2,
      yaw,
      height: 2,
    };
    const original = upperDoor(0, "NORTH", false, placement);
    const mirror = upperDoor(0, "NORTH", false, {
      ...placement,
      mirrored: true,
    });
    for (const step of [0, .2, 1]) {
      original.door.openTemporarily(10); original.door.update(step);
      mirror.door.openTemporarily(10); mirror.door.update(step);
      const a = original.entity.children[0].getWorldTransform().transformPoint(new pc.Vec3(1, .5, 0));
      const b = mirror.entity.children[0].getWorldTransform().transformPoint(new pc.Vec3(1, .5, 0));
      const center = original.entity.getPosition(), angle = yaw * Math.PI / 180;
      const tangent = (point) => (point.x - center.x) * Math.cos(angle) - (point.z - center.z) * Math.sin(angle);
      const normal = (point) => (point.x - center.x) * Math.sin(angle) + (point.z - center.z) * Math.cos(angle);
      assert.ok(Math.abs(tangent(b) + tangent(a)) < 1e-6);
      assert.ok(Math.abs(normal(b) - normal(a)) < 1e-6);
      assert.equal(mirror.door.blocksCameraAt(b.x, b.y, b.z, .1), true);
      const collider = mirror.entity.findComponents("render")[0].entity.children[0];
      const transform = collider.getWorldTransform();
      assert.equal(mirror.door.getPointerHit(
        transform.transformPoint(new pc.Vec3(0, 0, -.5)),
        transform.transformPoint(new pc.Vec3(0, 0, .5)),
      )?.pointerTarget, mirror.door);
    }
  }
});

it("lets terrace choreography request a swing without bypassing hero clearance", () => {
  const { door } = upperDoor();
  let openings = 0;
  door.onOpen = () => {
    openings++;

    return true;
  };
  assert.equal(door.handlePointerDown(), true);
  assert.equal(openings, 1);
  door.sequenceOpenAmount = 1;
  door.update(1);
  assert.ok(Math.abs(door.openAmount - 1) < 0.000001);
  door.updateHeroPosition({
    x: 0,
    y: 3,
    z: 1.5,
  });
  assert.equal(openings, 2);
  door.sequenceOpenAmount = 0;
  door.update(1);
  assert.ok(Math.abs(door.openAmount - 1) < 0.000001, "a hero in the doorway prevents closure");
  door.updateHeroPosition({
    x: 20,
    y: 3,
    z: 20,
  });
  door.update(1);
  assert.ok(door.openAmount < 0.000001);
  door.onOpen = null;
  door.sequenceOpenAmount = null;
});
