import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";
import Ammo from "sync-ammo/dist/ammo.module.js";

// GPU batching is replaced; production fragment constraints run in real Ammo.
const sourceUrl = new URL("../../../../../src/game/objects/path/BridgeDeckFragment.js", import.meta.url);
const source = readFileSync(sourceUrl, "utf8")
  .replace('from "./BridgeProfile.js"', `from "${new URL("./BridgeProfile.js", sourceUrl).href}"`)
  .replace('import { BridgeRailingKit } from "./BridgeRailingKit.js";', `
    class BridgeRailingKit {
      constructor({root}) { this.root=root; root.testRails=[]; }
      addRailing(options) { this.root.testRails.push(options); }
      build() { return []; }
    }
  `)
  .replace('import { BridgeArtwork } from "./BridgeArtwork.js";', `
    class BridgeArtwork {
      constructor({root}) { root.testDeck=this; this.stations=[]; }
      addStation(options) { this.stations.push(options); }
      build() { return [{destroy: () => { this.disposed=true; }}]; }
    }
  `);
const { BridgeDeckFragment } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

/**
 * A component adapter synchronizes engine transforms only. No integration,
 * gravity, trajectory, or constraint math is substituted for Ammo.
 */
function environment() {
  const configuration = new Ammo.btDefaultCollisionConfiguration();
  const dispatcher = new Ammo.btCollisionDispatcher(configuration);
  const broadphase = new Ammo.btDbvtBroadphase();
  const solver = new Ammo.btSequentialImpulseConstraintSolver();
  const world = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, configuration);
  // This bundled Ammo build exposes add/remove, but no constraint-count getter.
  const constraints = new Set();
  const addConstraint = world.addConstraint.bind(world);
  const removeConstraint = world.removeConstraint.bind(world);
  world.addConstraint = (constraint, disableCollision) => {
    addConstraint(constraint, disableCollision);
    constraints.add(constraint);
  };
  world.removeConstraint = (constraint) => {
    removeConstraint(constraint);
    constraints.delete(constraint);
  };
  world.getNumConstraints = () => constraints.size;
  const gravity = new Ammo.btVector3(0, -22, 0);
  world.setGravity(gravity);
  Ammo.destroy(gravity);
  const bodies = new Set();
  class ComponentEntity extends pc.Entity {
    /**
     * @param {string} name
     * @param {Record<string, number|string|pc.Vec3>} options
     */
    addComponent(name, options) {
      if (name !== "rigidbody") {
        this[name] = options;

        return;
      }
      const shapes = [];
      const shape = new Ammo.btCompoundShape();
      for (const child of this.children) {
        if (child.collision?.type !== "box") {
          continue;
        }
        const half = child.collision.halfExtents;
        const size = new Ammo.btVector3(half.x, half.y, half.z);
        const box = new Ammo.btBoxShape(size);
        Ammo.destroy(size);
        const transform = new Ammo.btTransform();
        transform.setIdentity();
        const point = child.getLocalPosition();
        const position = new Ammo.btVector3(point.x, point.y, point.z);
        transform.setOrigin(position);
        const rotation = child.getLocalRotation();
        const quaternion = new Ammo.btQuaternion(rotation.x, rotation.y, rotation.z, rotation.w);
        transform.setRotation(quaternion);
        shape.addChildShape(transform, box);
        Ammo.destroy(quaternion);
        Ammo.destroy(position);
        Ammo.destroy(transform);
        shapes.push(box);
      }
      const transform = new Ammo.btTransform();
      transform.setIdentity();
      const point = this.getPosition();
      const position = new Ammo.btVector3(point.x, point.y, point.z);
      transform.setOrigin(position);
      Ammo.destroy(position);
      const motion = new Ammo.btDefaultMotionState(transform);
      const inertia = new Ammo.btVector3(0, 0, 0);
      shape.calculateLocalInertia(options.mass, inertia);
      const info = new Ammo.btRigidBodyConstructionInfo(options.mass, motion, shape, inertia);
      const body = new Ammo.btRigidBody(info);
      body.setDamping(options.linearDamping, options.angularDamping);
      world.addRigidBody(body, options.group ?? (options.type === "static" ? pc.BODYGROUP_STATIC : pc.BODYGROUP_DYNAMIC),
        options.mask ?? pc.BODYMASK_ALL);
      Ammo.destroy(info);
      Ammo.destroy(inertia);
      const entity = this;
      const events = new pc.EventHandler();
      this.rigidbody = {
        type: options.type,
        group: options.group,
        mask: options.mask,
        body,
        on: events.on.bind(events),
        fire: events.fire.bind(events),
        get linearVelocity() {
          const velocity = body.getLinearVelocity();

          return new pc.Vec3(velocity.x(), velocity.y(), velocity.z());
        },
        set linearVelocity(velocity) {
          const value = new Ammo.btVector3(velocity.x, velocity.y, velocity.z);
          body.setLinearVelocity(value);
          Ammo.destroy(value);
        },
        get angularVelocity() {
          const velocity = body.getAngularVelocity();

          return new pc.Vec3(velocity.x(), velocity.y(), velocity.z());
        },
        set angularVelocity(velocity) {
          const value = new Ammo.btVector3(velocity.x, velocity.y, velocity.z);
          body.setAngularVelocity(value);
          Ammo.destroy(value);
        },
        applyTorqueImpulse: (x, y, z) => {
          const impulse = new Ammo.btVector3(x, y, z);
          body.applyTorqueImpulse(impulse);
          Ammo.destroy(impulse);
        },
        sync: () => {
          motion.getWorldTransform(transform);
          const p = transform.getOrigin();
          const q = transform.getRotation();
          entity.setPosition(p.x(), p.y(), p.z());
          entity.setRotation(q.x(), q.y(), q.z(), q.w());
        },
        dispose: () => {
          events.off();
          world.removeRigidBody(body);
          Ammo.destroy(body);
          Ammo.destroy(motion);
          Ammo.destroy(transform);
          Ammo.destroy(shape);
          for (const box of shapes) {
            Ammo.destroy(box);
          }
          bodies.delete(entity);
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
  const root = new ComponentEntity("Real Ammo fragment test");
  const events = new pc.EventHandler();
  const app = {
    root,
    on: events.on.bind(events),
    fire: events.fire.bind(events),
    hasEvent: events.hasEvent.bind(events),
    systems: { rigidbody: { dynamicsWorld: world } },
  };

  return {
    app,
    world,
    constraints,
    pc: {
      ...pc,
      Entity: ComponentEntity,
    },
    step: (frames) => {
      for (let frame = 0; frame < frames; frame++) {
        world.stepSimulation(1 / 120, 1, 1 / 120);
        for (const entity of bodies) {
          entity.rigidbody.sync();
        }
      }
    },
    destroy: () => {
      assert.equal(bodies.size, 0);
      assert.equal(world.getNumConstraints(), 0);
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
 * @param {ReturnType<typeof environment>} context
 * @param {number} station
 * @param {boolean} horizontal
 * @param {boolean} floating
 * @param {number} startRise
 * @param {number} endRise
 */
function fragment(context, station = 0, horizontal = true, floating = false, startRise = 0, endRise = 0) {
  return new BridgeDeckFragment({
    pc: context.pc,
    app: context.app,
    modelLibrary: {},
    materials: [],
    definition: {
      material: "timber",
      span: {
        horizontal,
        start: 0,
        end: 2,
      },
    },
    station,
    position: new pc.Vec3(horizontal ? station : 0, 3, horizontal ? 0 : station),
    floating,
    startRise,
    endRise,
  });
}

it("floating fragments hover in real Ammo while lift flickers, then restore gravity without bank hinges", () => {
  const previous = globalThis.Ammo;
  globalThis.Ammo = Ammo;
  try {
    for (const horizontal of [false, true]) {
      const context = environment();
      const part = fragment(context, 1, horizontal, true);
      const initial = part.entity.getPosition().clone();
      const emissiveValues = [];
      part.entity.findComponents = () => [{
        meshInstances: [{
          node: { name: "Floating rune inset" },
          setParameter: (name, value) => {
            assert.equal(name, "material_emissiveIntensity");
            emissiveValues.push(value);
          },
        }],
      }];
      for (let frame = 0; frame < 72; frame++) {
        part.update(1 / 120);
        context.step(1);
      }
      assert.equal(part.hasSupport, false);
      assert.equal(context.world.getNumConstraints(), 0);
      assert.ok(Math.abs(part.entity.getPosition().y - initial.y) < 0.03,
        `hover height ${part.entity.getPosition().y}`);
      assert.ok(part.entity.getPosition().distance(initial) > 0.04);
      assert.ok(part.liftStrength > 0 && part.liftStrength < 0.3);
      assert.ok(emissiveValues.some((value, index) => index > 0 && value > emissiveValues[index - 1]));
      for (let frame = 0; frame < 84; frame++) {
        part.update(1 / 120);
        context.step(1);
      }
      assert.equal(part.liftStrength, 0);
      assert.equal(emissiveValues.at(-1), 0);
      assert.ok(part.entity.getPosition().y < initial.y - 1.5,
        `fall height ${part.entity.getPosition().y}`);
      assert.ok(part.entity.rigidbody.linearVelocity.y < -5);
      part.destroy();
      part.update(1);
      context.destroy();
    }
  } finally {
    globalThis.Ammo = previous;
  }
});

it("ordinary fragments retain immediate gravity when the floating update hook is called", () => {
  const context = environment();
  const part = fragment(context, 1);
  const initial = part.entity.getPosition().y;
  for (let frame = 0; frame < 48; frame++) {
    part.update(1 / 120);
    context.step(1);
  }
  assert.equal(part.liftStrength, 0);
  assert.ok(part.entity.getPosition().y < initial - 1);
  part.destroy();
  context.destroy();
});

it("a dynamic hero body collides with and rides the visible released deck instead of passing through it", () => {
  const previous = globalThis.Ammo;
  globalThis.Ammo = Ammo;
  const context = environment();
  const part = fragment(context, 1, true, true);
  const hero = new context.pc.Entity("Hero capsule stand-in");
  try {
    assert.equal(part.entity.tags.has("hero-surface-ignore"), false);
    assert.equal(part.entity.tags.has("hero-moving-support"), true);
    assert.ok(part.entity.rigidbody.mask & pc.BODYGROUP_DYNAMIC);
    const deck = part.entity.findByTag("hero-support-surface");
    assert.equal(deck.length, 1);
    hero.setPosition(1, 3.3, 0);
    context.app.root.addChild(hero);
    hero.addComponent("collision", { type: "compound" });
    const bodyCollider = new context.pc.Entity("Standing body");
    bodyCollider.setLocalPosition(0, 0.7, 0);
    bodyCollider.addComponent("collision", {
      type: "box",
      halfExtents: new pc.Vec3(0.15, 0.7, 0.15),
    });
    hero.addChild(bodyCollider);
    hero.addComponent("rigidbody", {
      type: "dynamic",
      mass: 1,
      group: pc.BODYGROUP_DYNAMIC,
      mask: pc.BODYMASK_ALL,
      linearDamping: 0,
      angularDamping: 1,
    });
    const factor = new Ammo.btVector3(0, 0, 0);
    hero.rigidbody.body.setAngularFactor(factor);
    Ammo.destroy(factor);
    for (let frame = 0; frame < 72; frame++) {
      part.update(1 / 120);
      context.step(1);
    }
    const top = part.entity.getWorldTransform().transformPoint(new pc.Vec3(0, 0.12, 0));
    assert.ok(Math.abs(hero.getPosition().y - top.y) < 0.08,
      `hero feet ${hero.getPosition().y}, moving deck ${top.y}`);
    assert.ok(hero.getPosition().y > 2.3);
  } finally {
    hero.destroy();
    part.destroy();
    context.destroy();
    globalThis.Ammo = previous;
  }
});

it("floating lift survives reparenting that re-adds the body and restores Ammo world gravity", () => {
  const previous = globalThis.Ammo;
  globalThis.Ammo = Ammo;
  const context = environment();
  const part = fragment(context, 1, true, true);
  try {
    const initialHeight = part.entity.getPosition().y;
    const bridgeRoot = new context.pc.Entity("Bridge object root");
    context.app.root.addChild(bridgeRoot);
    bridgeRoot.addChild(part.entity);
    const body = part.entity.rigidbody.body;
    // PlayCanvas disables and enables simulation during a scene reparent.
    // Ammo's actual addRigidBody operation resets the body's local gravity.
    context.world.removeRigidBody(body);
    context.world.addRigidBody(body);
    assert.equal(body.getGravity().y(), -22);
    part.update(0);
    assert.equal(body.getGravity().y(), 0);
    for (let frame = 0; frame < 72; frame++) {
      if (frame === 24) {
        context.world.removeRigidBody(body);
        context.world.addRigidBody(body);
        assert.equal(body.getGravity().y(), -22);
      }
      part.update(1 / 120);
      context.step(1);
    }
    assert.ok(Math.abs(part.entity.getPosition().y - initialHeight) < 0.03);
    assert.ok(Math.abs(part.entity.rigidbody.linearVelocity.y) < 0.03);
    part.update(0.21);
    assert.equal(body.getGravity().y(), -22);
    context.step(48);
    assert.ok(part.entity.getPosition().y < initialHeight - 1);
  } finally {
    part.destroy();
    context.destroy();
    globalThis.Ammo = previous;
  }
});

it("arched station artwork, railing, and compound colliders retain the same slope when released", () => {
  for (const horizontal of [false, true]) {
    const context = environment();
    const part = fragment(context, 1, horizontal, false, -0.15, 0.15);
    const artwork = part.entity.testDeck.stations[0];
    assert.equal(artwork.startRise, -0.15);
    assert.equal(artwork.endRise, 0.15);
    const railing = part.entity.testRails[0];
    assert.ok(Math.abs(railing.position.y - (0.12 - 0.15)) < 0.000001);
    assert.equal(railing.direction.y, 0.3);
    assert.ok(Math.abs(railing.length - Math.hypot(1, 0.3)) < 0.000001);
    const collider = part.entity.children.find((child) => child.name === "Original deck slab");
    const along = collider.getLocalRotation().transformVector(new pc.Vec3(horizontal ? 1 : 0, 0, horizontal ? 0 : 1));
    assert.ok(Math.abs(along.y / Math.hypot(along.x, along.z) - 0.3) < 0.000001);
    assert.ok(part.freeEdgeDrop(1) < 0.000001);
    assert.ok(part.freeEdgeDrop(-1) < 0.000001);
    part.destroy();
    context.destroy();
  }
});

it("neighbouring arch stations use their own edge heights for two-body Ammo hinges", () => {
  const previous = globalThis.Ammo;
  globalThis.Ammo = Ammo;
  try {
    for (const horizontal of [false, true]) {
      const context = environment();
      const first = fragment(context, 0, horizontal, false, -0.15, 0.15);
      const next = fragment(context, 1, horizontal, false, 0.15, -0.15);
      next.anchor(1);
      assert.equal(first.connectTo(next, 1), true);
      context.step(24);
      const firstEdge = first.entity.getWorldTransform().transformPoint(
        new pc.Vec3(horizontal ? 0.5 : 0, 0.03, horizontal ? 0 : 0.5));
      const nextEdge = next.entity.getWorldTransform().transformPoint(
        new pc.Vec3(horizontal ? -0.5 : 0, 0.03, horizontal ? 0 : -0.5));
      assert.ok(firstEdge.distance(nextEdge) < 0.04, `arched hinge seam ${firstEdge.distance(nextEdge)}`);
      first.destroy();
      next.destroy();
      context.destroy();
    }
  } finally {
    globalThis.Ammo = previous;
  }
});

it("real Ammo hinges hold the far edge while gravity drops the free edge on both axes and directions", () => {
  const previous = globalThis.Ammo;
  globalThis.Ammo = Ammo;
  try {
    for (const horizontal of [false, true]) {
      for (const direction of [-1, 1]) {
        const context = environment();
        const part = fragment(context, 0, horizontal);
        assert.equal(part.anchor(direction), true);
        assert.equal(context.world.getNumConstraints(), 2);
        context.step(48);
        const local = new pc.Vec3(horizontal ? direction * 0.5 : 0, -0.12, horizontal ? 0 : direction * 0.5);
        const held = part.entity.getWorldTransform().transformPoint(local);
        assert.ok(Math.abs(held.y - 2.76) < 0.025, `held height ${held.y}`);
        assert.ok(part.freeEdgeDrop(direction) > 0.14, `drop ${part.freeEdgeDrop(direction)}`);
        part.destroy();
        context.destroy();
      }
    }
  } finally {
    globalThis.Ammo = previous;
  }
});

it("real two-body joints transfer the falling station's load and clean up incoming links before bodies", () => {
  const previous = globalThis.Ammo;
  globalThis.Ammo = Ammo;
  const context = environment();
  const first = fragment(context, 0);
  const next = fragment(context, 1);
  try {
    first.anchor(1);
    context.step(24);
    next.anchor(1);
    assert.equal(first.connectTo(next, 1), true);
    assert.equal(context.world.getNumConstraints(), 4);
    const hinge = [...context.constraints].at(-1);
    context.step(48);
    const firstPivot = hinge.getPivotInA();
    const nextPivot = hinge.getPivotInB();
    const a = first.entity.getWorldTransform().transformPoint(new pc.Vec3(firstPivot.x(), firstPivot.y(), firstPivot.z()));
    const b = next.entity.getWorldTransform().transformPoint(new pc.Vec3(nextPivot.x(), nextPivot.y(), nextPivot.z()));
    assert.ok(a.distance(b) < 0.04, `hinge seam ${a.distance(b)}`);
    assert.ok(next.freeEdgeDrop(1) > 0.14);
    assert.ok(first.supportAngleTo(next) > 0);
    // Destroy the linked-to body first: its incoming owner must release joints.
    next.destroy();
    assert.equal(first.hasSupport, false);
    assert.equal(context.world.getNumConstraints(), 0);
    first.destroy();
    first.destroy();
    context.destroy();
  } finally {
    globalThis.Ammo = previous;
  }
});

it("new hinges start stress-free at one world pivot after both Ammo bodies have moved and rotated", () => {
  const previous = globalThis.Ammo;
  globalThis.Ammo = Ammo;
  /**
   * @param {import("playcanvas").Entity} entity
   * @param {import("playcanvas").Vec3} position
   * @param {import("playcanvas").Quat} rotation
   */
  const poseBody = (entity, position, rotation) => {
    const body = entity.rigidbody.body;
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    const point = new Ammo.btVector3(position.x, position.y, position.z);
    const quaternion = new Ammo.btQuaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    const zero = new Ammo.btVector3(0, 0, 0);
    transform.setOrigin(point);
    transform.setRotation(quaternion);
    body.setWorldTransform(transform);
    body.getMotionState().setWorldTransform(transform);
    body.setGravity(zero);
    body.setLinearVelocity(zero);
    body.setAngularVelocity(zero);
    body.activate();
    Ammo.destroy(zero);
    Ammo.destroy(quaternion);
    Ammo.destroy(point);
    Ammo.destroy(transform);
  };
  /**
   * @param {import("sync-ammo/dist/ammo").btRigidBody} body
   * @param {import("sync-ammo/dist/ammo").btVector3} pivot
   */
  const worldPivot = (body, pivot) => {
    const transform = body.getCenterOfMassTransform();
    const position = transform.getOrigin();
    const q = transform.getRotation();
    const rotation = new pc.Quat(q.x(), q.y(), q.z(), q.w());

    return rotation.transformVector(new pc.Vec3(pivot.x(), pivot.y(), pivot.z()))
      .add(new pc.Vec3(position.x(), position.y(), position.z()));
  };
  try {
    for (const horizontal of [false, true]) {
      for (const direction of [-1, 1]) {
        const context = environment();
        const first = fragment(context, 0, horizontal);
        const next = fragment(context, direction, horizontal);
        poseBody(first.entity, new pc.Vec3(0, 2.4, 0),
          new pc.Quat().setFromEulerAngles(horizontal ? 8 : -22, 12, horizontal ? 22 : 8));
        poseBody(next.entity, new pc.Vec3(horizontal ? direction * 0.8 : 0, 2.9, horizontal ? 0 : direction * 0.8),
          new pc.Quat().setFromEulerAngles(horizontal ? -9 : 13, -15, horizontal ? -13 : -9));
        // The rendering entities are deliberately stale. Constraint creation
        // must use Ammo's actual poses rather than waiting for render sync.
        assert.notEqual(first.entity.getPosition().y, 2.4);
        assert.equal(first.connectTo(next, direction), true);
        assert.equal(context.constraints.size, 2);
        for (const hinge of context.constraints) {
          const a = worldPivot(first.entity.rigidbody.body, hinge.getPivotInA());
          const b = worldPivot(next.entity.rigidbody.body, hinge.getPivotInB());
          assert.ok(a.distance(b) < 0.000001, `initial hinge mismatch ${a.distance(b)}`);
        }
        context.step(12);
        assert.ok(first.entity.rigidbody.linearVelocity.length() < 0.001,
          `first section solver kick ${first.entity.rigidbody.linearVelocity.length()}`);
        assert.ok(next.entity.rigidbody.linearVelocity.length() < 0.001,
          `next section solver kick ${next.entity.rigidbody.linearVelocity.length()}`);
        first.destroy();
        next.destroy();
        context.destroy();
      }
    }
  } finally {
    globalThis.Ammo = previous;
  }
});

it("the underside hinge clears adjacent intact terrain instead of jamming until a timer releases it", () => {
  const previous = globalThis.Ammo;
  globalThis.Ammo = Ammo;
  try {
    for (const horizontal of [false, true]) {
      for (const direction of [-1, 1]) {
        const context = environment();
        const part = fragment(context, 0, horizontal);
        const bank = new context.pc.Entity("Adjacent intact bank");
        bank.setPosition(horizontal ? direction : 0, 2.88, horizontal ? 0 : direction);
        context.app.root.addChild(bank);
        bank.addComponent("collision", { type: "compound" });
        const box = new context.pc.Entity("Bank extends down below the deck edge");
        box.setLocalPosition(0, -1, 0);
        box.addComponent("collision", {
          type: "box",
          halfExtents: new pc.Vec3(horizontal ? 0.5 : 1, 1.12, horizontal ? 1 : 0.5),
        });
        bank.addChild(box);
        bank.addComponent("rigidbody", {
          mass: 0,
          type: "static",
          linearDamping: 0,
          angularDamping: 0,
        });
        part.anchor(direction);
        context.step(48);
        assert.ok(part.freeEdgeDrop(direction) > 0.22, `adjacent-bank drop ${part.freeEdgeDrop(direction)}`);
        assert.equal(part.hasSupport, true);
        part.destroy();
        bank.destroy();
        context.destroy();
      }
    }
  } finally {
    globalThis.Ammo = previous;
  }
});

it("keeps original deck materials, shared-post ownership, and unscaled compound roots without Ammo joints", () => {
  const previous = globalThis.Ammo;
  globalThis.Ammo = undefined;
  const context = environment();
  const part = fragment(context, 1);
  try {
    assert.equal(part.anchor(1), false);
    assert.equal(part.hasSupport, false);
    assert.deepEqual(part.entity.getLocalScale(), pc.Vec3.ONE);
    assert.equal(part.entity.collision.type, "compound");
    assert.equal(part.entity.children.filter((child) => child.collision).length, 3);
    assert.equal(part.entity.testDeck.stations[0].definition.material, "timber");
    assert.equal(part.entity.testDeck.stations[0].position.y, 0.12);
    assert.equal(part.entity.testRails.length, 2);
    assert.equal(part.entity.testRails[0].position.y, 0.12);
    assert.equal(part.entity.testRails[0].endPost, false);
    const deck = part.entity.testDeck;
    part.destroy();
    assert.equal(deck.disposed, true);
    context.destroy();
  } finally {
    globalThis.Ammo = previous;
  }
});

it("fades only fragment-owned material clones and disposes them on restore or destruction", () => {
  const context = environment();
  const part = fragment(context, 1);
  const original = new pc.StandardMaterial();
  const first = { material: original };
  const second = { material: original };
  const untouched = { material: original };
  let disposed = 0;
  const cloneMaterial = original.clone.bind(original);
  original.clone = () => {
    const clone = cloneMaterial();
    const destroy = clone.destroy.bind(clone);
    clone.destroy = () => {
      disposed++;
      destroy();
    };

    return clone;
  };
  part.entity.findComponents = () => [{ meshInstances: [first, second] }];
  part.opacity = 1;
  assert.equal(first.material, original);
  part.opacity = 0.4;
  const faded = first.material;
  assert.notEqual(faded, original);
  assert.equal(second.material, faded);
  assert.equal(faded.opacity, 0.4);
  assert.equal(faded.blendType, pc.BLEND_NORMAL);
  assert.equal(faded.depthWrite, false);
  assert.equal(untouched.material.opacity, 1);
  assert.equal(untouched.material.depthWrite, true);
  part.opacity = 0.2;
  assert.equal(first.material, faded);
  assert.equal(faded.opacity, 0.2);
  part.opacity = 1;
  assert.equal(first.material, original);
  assert.equal(second.material, original);
  assert.equal(disposed, 1);
  part.opacity = 0.3;
  part.destroy();
  assert.equal(disposed, 2);
  assert.equal(original.opacity, 1);
  original.destroy();
  context.destroy();
});

it("queues one lower-floor impact, rejects bank and moving-body contacts, and remembers incoming velocity", () => {
  for (const normalSign of [-1, 1]) {
    const context = environment();
    const part = fragment(context, 1);
    const ground = new pc.Entity("Static floor");
    ground.rigidbody = { type: "static" };
    const moving = new pc.Entity("Another falling station");
    moving.rigidbody = { type: "dynamic" };
    const contact = {
      normal: new pc.Vec3(0, normalSign, 0),
      pointOther: new pc.Vec3(1, 0, 0),
    };
    part.age = 0.5;
    // Engine-delivered contact policy is exercised independently of integration.
    part.entity.rigidbody.fire("contact", {
      other: ground,
      contacts: [contact],
    });
    assert.equal(part.consumeGroundImpact(), null);
    part.entity.setPosition(1, 0.3, 0);
    part.age = 0.05;
    part.entity.rigidbody.fire("contact", {
      other: ground,
      contacts: [contact],
    });
    assert.equal(part.consumeGroundImpact(), null);
    part.age = 0.5;
    part.entity.rigidbody.fire("contact", {
      other: moving,
      contacts: [contact],
    });
    part.entity.rigidbody.fire("contact", {
      other: ground,
      contacts: [{
        ...contact,
        normal: new pc.Vec3(1, 0, 0),
      }],
    });
    part.entity.rigidbody.fire("contact", {
      other: ground,
      contacts: [{
        ...contact,
        pointOther: new pc.Vec3(1, 2.76, 0),
      }],
    });
    assert.equal(part.consumeGroundImpact(), null);
    part.entity.rigidbody.linearVelocity = new pc.Vec3(0.5, -3, 0);
    context.app.fire("update", 1 / 60);
    part.entity.rigidbody.linearVelocity = new pc.Vec3();
    part.entity.rigidbody.fire("contact", {
      other: ground,
      contacts: [contact],
    });
    const impact = part.consumeGroundImpact();
    assert.equal(part.station, 1);
    assert.ok(Math.abs(impact.position.y - 0.3) < 0.000001);
    assert.equal(impact.velocity.y, -3);
    assert.equal(impact.contactPoint.y, 0);
    assert.equal(part.consumeGroundImpact(), null);
    part.entity.rigidbody.fire("contact", {
      other: ground,
      contacts: [contact],
    });
    assert.equal(part.consumeGroundImpact(), null);
    assert.equal(context.app.hasEvent("update"), true);
    part.destroy();
    assert.equal(context.app.hasEvent("update"), false);
    context.destroy();
  }
});

it("detects a shallow floor hit after a small meaningful drop", () => {
  const context = environment();
  const part = fragment(context, 1);
  const ground = new pc.Entity("Shallow static floor");
  ground.rigidbody = { type: "static" };
  part.age = 0.2;
  part.entity.setPosition(1, 2.62, 0);
  part.entity.rigidbody.fire("contact", {
    other: ground,
    contacts: [{
      normal: new pc.Vec3(0, 1, 0),
      pointOther: new pc.Vec3(1, 2.5, 0),
    }],
  });
  assert.notEqual(part.consumeGroundImpact(), null);
  part.destroy();
  context.destroy();
});
