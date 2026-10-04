import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import Ammo from "sync-ammo/dist/ammo.module.js";
import { CastleDoorSwingPhysics } from "../../../../../src/game/objects/castle/CastleDoorSwingPhysics.js";

it("queries actual Ammo wall contacts at candidate poses without moving the door body", () => {
  const previousAmmo = globalThis.Ammo;
  globalThis.Ammo = Ammo;
  const configuration = new Ammo.btDefaultCollisionConfiguration();
  const dispatcher = new Ammo.btCollisionDispatcher(configuration);
  const broadphase = new Ammo.btDbvtBroadphase();
  const solver = new Ammo.btSequentialImpulseConstraintSolver();
  const world = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, configuration);
  const extents = new Ammo.btVector3(.5, 1, .025);
  const shape = new Ammo.btBoxShape(extents);
  const wallExtents = new Ammo.btVector3(.1, 2, 2);
  const wallShape = new Ammo.btBoxShape(wallExtents);
  const wall = new Ammo.btPairCachingGhostObject();
  const body = new Ammo.btPairCachingGhostObject();
  const transform = new Ammo.btTransform();
  transform.setIdentity();
  const position = new Ammo.btVector3(1, 1, 0);
  transform.setOrigin(position);
  wall.setCollisionFlags(1);
  wall.setCollisionShape(wallShape);
  wall.setWorldTransform(transform);
  world.addCollisionObject(wall, 1, -1);
  body.setCollisionShape(shape);
  const entity = new pc.Entity("moving door");
  entity.rigidbody = { system: { dynamicsWorld: world }, body };
  entity._enabledInHierarchy = true;
  entity.setPosition(0, 1, 0);
  const swing = new CastleDoorSwingPhysics([{ entity, half: [.5, 1, .025] }]);
  try {
    assert.equal(swing.contacts().size, 0, "clear pose has no contacts");
    entity.setPosition(.8, 1, 0);
    const contacts = swing.contacts();
    assert.ok(contacts.get(Ammo.getPointer(wall)) > .1, "wall penetration comes from Ammo narrow phase");
    assert.equal(body.getWorldTransform().getOrigin().x(), 0, "query never moves the real collider");
    world.removeCollisionObject(wall);
    assert.equal(swing.contacts().size, 0, "removing the obstacle releases the door");
  } finally {
    swing.destroy();
    for (const resource of [wall, body, shape, wallShape, extents, wallExtents, transform, position, world, solver, broadphase, dispatcher, configuration]) {
      Ammo.destroy(resource);
    }
    globalThis.Ammo = previousAmmo;
  }
});
