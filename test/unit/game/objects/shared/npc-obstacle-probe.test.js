import assert from "node:assert/strict";
import { it } from "node:test";
import AmmoModule from "sync-ammo/dist/ammo.module.js";
import * as pc from "playcanvas";
import { NpcObstacleProbe } from "../../../../../src/game/objects/shared/NpcObstacleProbe.js";

it("queries Ammo prop geometry with actor clearance and releases its resources", () => {
  const previous = globalThis.Ammo;
  const Ammo = AmmoModule.default ?? AmmoModule;
  globalThis.Ammo = Ammo;
  const configuration = new Ammo.btDefaultCollisionConfiguration();
  const dispatcher = new Ammo.btCollisionDispatcher(configuration);
  const broadphase = new Ammo.btDbvtBroadphase();
  const solver = new Ammo.btSequentialImpulseConstraintSolver();
  const world = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, configuration);
  const half = new Ammo.btVector3(0.3, 0.5, 0.3);
  const shape = new Ammo.btBoxShape(half);
  const inertia = new Ammo.btVector3(0, 0, 0);
  const info = new Ammo.btRigidBodyConstructionInfo(0, null, shape, inertia);
  const body = new Ammo.btRigidBody(info);
  const transform = new Ammo.btTransform();
  transform.setIdentity();
  const origin = new Ammo.btVector3(1, 0.5, 0);
  transform.setOrigin(origin);
  body.setWorldTransform(transform);
  const prop = new pc.Entity("Furniture");
  prop.tags.add("map-object", "Table");
  Object.defineProperty(prop, "rigidbody", { value: { type: "static" } });
  body.entity = prop;
  world.addRigidBody(body);
  const probe = new NpcObstacleProbe({ systems: { rigidbody: { dynamicsWorld: world } } });
  try {
    assert.equal(probe.blockedAt({
      x: 0.5,
      y: 0,
      z: 0,
    }), true);
    assert.equal(probe.blockedAt({
      x: 0.3,
      y: 0,
      z: 0,
    }), false);
    assert.equal(probe.blockedAt({
      x: 1,
      y: 2,
      z: 0,
    }), false);
    prop.tags.add("Castle");
    assert.equal(probe.blockedAt({
      x: 0.5,
      y: 0,
      z: 0,
    }), false);
    prop.tags.remove("Castle");
    prop.tags.add("capsule-support");
    assert.equal(probe.blockedAt({
      x: 1,
      y: 0,
      z: 0,
    }), false);
    prop.tags.remove("capsule-support");
    prop.tags.add("Throne");
    const occupant = new pc.Entity();
    occupant.setPosition(1, 0, 0);
    const seatProbe = new NpcObstacleProbe({ systems: { rigidbody: { dynamicsWorld: world } } }, occupant);
    try {
      assert.equal(seatProbe.blockedAt({
        x: 1,
        y: 0,
        z: 0,
      }), false);
      assert.equal(seatProbe.blockedAt({
        x: 0.5,
        y: 0,
        z: 0,
      }), true);
      assert.equal(seatProbe.blockedAt({
        x: 1,
        y: 0,
        z: -0.3,
      }), true);
    } finally {
      seatProbe.destroy();
      occupant.destroy();
    }
  } finally {
    probe.destroy();
    world.removeRigidBody(body);
    for (const resource of [body, info, shape, half, inertia, transform, origin, world, solver, broadphase, dispatcher, configuration]) {
      Ammo.destroy(resource);
    }
    prop.destroy();
    globalThis.Ammo = previous;
  }
});
