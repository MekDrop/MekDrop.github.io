import test from "node:test";
import assert from "node:assert/strict";
import { Entity, EventHandler, Vec3 } from "playcanvas";
import { LatchBridgeContact } from "../../../../../../src/game/objects/enemies/latch-slug/LatchBridgeContact.js";
import Ammo from "sync-ammo/dist/ammo.module.js";

test("a contact latch follows the body's local anchor and detaches before body replacement", () => {
  const previous = globalThis.Ammo;
  const removed = [];
  const destroyed = [];
  class Vector {
    constructor(x, y, z) {
      Object.assign(this, {
        x,
        y,
        z,
      });
    }
  }
  class Constraint {
    constructor(first, second, anchorA, anchorB) {
      this.anchorA = anchorA;
      this.anchorB = anchorB;
    }
    setPivotB(value) {
      this.anchorB = value;
    }
  }
  globalThis.Ammo = {
    btVector3: Vector,
    btPoint2PointConstraint: Constraint,
    destroy: (value) => destroyed.push(value),
  };
  const app = new EventHandler();
  const system = new EventHandler();
  system.dynamicsWorld = {
    addConstraint: () => {},
    removeConstraint: (value) => removed.push(value),
  };
  app.systems = { rigidbody: system };
  const entity = new Entity();
  entity.rigidbody = { body: { activate: () => {} } };
  const other = new Entity();
  other.setPosition(2, 1, 0);
  other.rigidbody = { body: { activate: () => {} } };
  try {
    const latch = new LatchBridgeContact({
      app,
      entity,
      position: new Vec3(2, 2, 0),
    },
    other, new Vec3(2, 1.5, 0));
    assert.ok(latch.constraint);
    assert.equal(latch.constraint.anchorB.y, 1);
    latch.crawl(new Vec3(2.5, 1.5, 0), 0.1);
    assert.ok(Math.abs(latch.constraint.anchorB.x - 0.045) < 0.00001);
    assert.deepEqual(entity.getPosition().toArray(), [0, 0, 0]);
    other.setPosition(3, 2, 0);
    assert.deepEqual(latch.point.toArray(), [3.045, 2.5, 0]);
    const oldConstraint = latch.constraint;
    app.fire("bridge-slime:before-body-change", other, "replace");
    assert.equal(latch.point, null);
    assert.equal(removed.length, 1);
    other.rigidbody.body = {};
    app.fire("bridge-slime:after-body-change", other);
    assert.ok(latch.constraint);
    assert.notEqual(latch.constraint, oldConstraint);
    assert.deepEqual(latch.point.toArray(), [3.045, 2.5, 0]);
    app.fire("bridge-slime:before-body-change", other);
    assert.equal(latch.point, null);
    assert.equal(removed.length, 2);
    latch.destroy();
    assert.equal(removed.length, 2);
    assert.equal(destroyed.length, 7);
  } finally {
    globalThis.Ammo = previous;
  }
});

test("native Ammo retains a side-bound donor through support replacement and releases it on removal", () => {
  const previous = globalThis.Ammo;
  globalThis.Ammo = Ammo;
  const configuration = new Ammo.btDefaultCollisionConfiguration();
  const dispatcher = new Ammo.btCollisionDispatcher(configuration);
  const broadphase = new Ammo.btDbvtBroadphase();
  const solver = new Ammo.btSequentialImpulseConstraintSolver();
  const world = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, configuration);
  const constraints = new Set();
  const addConstraint = world.addConstraint.bind(world);
  const removeConstraint = world.removeConstraint.bind(world);
  world.addConstraint = (constraint, disabled) => {
    constraints.add(constraint);
    addConstraint(constraint, disabled);
  };
  world.removeConstraint = (constraint) => {
    constraints.delete(constraint);
    removeConstraint(constraint);
  };
  const gravity = new Ammo.btVector3(0, -22, 0);
  world.setGravity(gravity);
  Ammo.destroy(gravity);
  const app = new EventHandler();
  const system = new EventHandler();
  system.dynamicsWorld = world;
  app.systems = { rigidbody: system };
  const source = new Entity();
  const support = new Entity();
  source.setPosition(0.3, 2, 0);
  support.setPosition(0, 2, 0);
  const bodies = [];
  /**
   * @param {Entity} entity
   * @param {number} mass
   * @param {number} width
   */
  const create = (entity, mass, width) => {
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    const point = entity.getPosition();
    const origin = new Ammo.btVector3(point.x, point.y, point.z);
    transform.setOrigin(origin);
    Ammo.destroy(origin);
    const size = new Ammo.btVector3(width, 1, 1);
    const shape = mass ? new Ammo.btSphereShape(0.2) : new Ammo.btBoxShape(size);
    Ammo.destroy(size);
    const motion = new Ammo.btDefaultMotionState(transform);
    const inertia = new Ammo.btVector3(0, 0, 0);
    if (mass) {
      shape.calculateLocalInertia(mass, inertia);
    }
    const info = new Ammo.btRigidBodyConstructionInfo(mass, motion, shape, inertia);
    const body = new Ammo.btRigidBody(info);
    Ammo.destroy(info);
    Ammo.destroy(inertia);
    Ammo.destroy(transform);
    world.addRigidBody(body);
    entity.rigidbody = { body };
    const entry = {
      body,
      shape,
      motion,
    };
    bodies.push(entry);

    return entry;
  };
  /**
   * @param {{body:import("sync-ammo/dist/ammo").btRigidBody,shape:import("sync-ammo/dist/ammo").btCollisionShape,motion:import("sync-ammo/dist/ammo").btDefaultMotionState}} entry
   */
  const remove = (entry) => {
    world.removeRigidBody(entry.body);
    Ammo.destroy(entry.body);
    Ammo.destroy(entry.motion);
    Ammo.destroy(entry.shape);
    bodies.splice(bodies.indexOf(entry), 1);
  };
  const sourceBody = create(source, 1, 0);
  let supportBody = create(support, 0, 0.1);
  let latch = null;
  try {
    world.stepSimulation(1 / 120, 1, 1 / 120);
    let contacts = 0;
    for (let index = 0; index < dispatcher.getNumManifolds(); index++) {
      contacts += dispatcher.getManifoldByIndexInternal(index).getNumContacts();
    }
    assert.ok(contacts > 0, "the donor must first make a native contact with the vertical support");
    latch = new LatchBridgeContact({
      app,
      entity: source,
      position: source.getPosition(),
    },
    support, new Vec3(0.1, 2, 0));
    assert.equal(constraints.size, 1);
    app.fire("bridge-slime:before-body-change", support, "replace");
    assert.equal(constraints.size, 0, "old-body constraint is removed before native destruction");
    remove(supportBody);
    supportBody = create(support, 0, 0.12);
    app.fire("bridge-slime:after-body-change", support);
    assert.equal(constraints.size, 1);
    for (let frame = 0; frame < 120; frame++) {
      world.stepSimulation(1 / 120, 1, 1 / 120);
    }
    const retained = sourceBody.body.getWorldTransform().getOrigin().y();
    assert.ok(Math.abs(retained - 2) < 0.05, "native adhesion prevents the donor falling down the vertical face: " + retained);
    app.fire("bridge-slime:before-body-change", support, "destroy");
    remove(supportBody);
    assert.equal(constraints.size, 0);
    for (let frame = 0; frame < 60; frame++) {
      world.stepSimulation(1 / 120, 1, 1 / 120);
    }
    assert.ok(sourceBody.body.getWorldTransform().getOrigin().y() < 1,
      "permanent removal releases the donor back to native gravity");
  } finally {
    latch?.destroy();
    while (bodies.length) {
      remove(bodies[0]);
    }
    Ammo.destroy(world);
    Ammo.destroy(solver);
    Ammo.destroy(broadphase);
    Ammo.destroy(dispatcher);
    Ammo.destroy(configuration);
    globalThis.Ammo = previous;
  }
});
