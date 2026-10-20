import assert from "node:assert/strict";
import { test } from "node:test";
import * as pc from "playcanvas";
import Ammo from "sync-ammo/dist/ammo.module.js";
import { createDoorCollision } from "../../../../../../src/game/objects/architecture/door/DoorCollision.js";

test("moving doors skip static manifolds while retaining picking, swing queries and dynamic blocking", () => {
  const previousAmmo = globalThis.Ammo;
  globalThis.Ammo = Ammo;
  const device = new pc.NullGraphicsDevice({
    width: 1,
    height: 1,
  });
  const app = new pc.AppBase({ id: "door-collision-filter" });
  app.init({
    graphicsDevice: device,
    componentSystems: [pc.RenderComponentSystem, pc.CollisionComponentSystem, pc.RigidBodyComponentSystem],
    resourceHandlers: [],
  });
  const physics = app.systems.rigidbody;
  physics.onLibraryLoaded();
  physics.gravity.set(0, 0, 0);
  const material = new pc.StandardMaterial();
  const mesh = pc.Mesh.fromGeometry(device, new pc.BoxGeometry({ halfExtents: new pc.Vec3(0.5, 1, 0.05) }));
  const door = new pc.Entity("door");
  const plank = new pc.Entity("door plank");
  door.addChild(plank);
  app.root.addChild(door);
  plank.setLocalPosition(0, 1, 0);
  plank.addComponent("render", { meshInstances: [new pc.MeshInstance(mesh, material, plank)] });
  const collision = createDoorCollision(pc, door);
  const leaf = plank.children[0];
  const wall = new pc.Entity("masonry");
  app.root.addChild(wall);
  wall.setLocalPosition(0.7, 1, 0);
  wall.addComponent("collision", {
    type: "box",
    halfExtents: new pc.Vec3(0.3, 1, 0.2),
  });
  wall.addComponent("rigidbody", { type: "static" });
  try {
    physics.onUpdate(1 / 60);
    assert.equal(physics.dynamicsWorld.getDispatcher().getNumManifolds(), 0);
    assert.equal(physics.raycastFirst(new pc.Vec3(0, 1, 1), new pc.Vec3(0, 1, -1)).entity, leaf);

    // Another moving door must remain visible to the native swing probe.
    const other = new pc.Entity("other door");
    app.root.addChild(other);
    other.setLocalPosition(0.2, 1, 0);
    other.addComponent("collision", {
      type: "box",
      halfExtents: new pc.Vec3(0.3, 1, 0.05),
    });
    other.addComponent("rigidbody", {
      type: "kinematic",
      group: leaf.rigidbody.group,
      mask: leaf.rigidbody.mask,
    });
    assert.ok(collision.swing.contacts().has(Ammo.getPointer(other.rigidbody.body)));
    other.destroy();

    const actor = new pc.Entity("dynamic character");
    app.root.addChild(actor);
    actor.setLocalPosition(0, 1, 0.7);
    actor.addComponent("collision", {
      type: "sphere",
      radius: 0.15,
    });
    actor.addComponent("rigidbody", {
      type: "dynamic",
      mass: 1,
    });
    actor.rigidbody.linearVelocity = new pc.Vec3(0, 0, -2);
    for (let frame = 0; frame < 120; frame++) {
      physics.onUpdate(1 / 120);
    }
    assert.ok(actor.getPosition().z >= 0.19, "the dynamic character cannot cross a closed door");

    // Preserve the rope/debris groups' previous exclusion of moving doors.
    assert.equal(leaf.rigidbody.mask & pc.BODYGROUP_USER_5, 0);
  } finally {
    collision.destroy();
    app.destroy();
    material.destroy();
    globalThis.Ammo = previousAmmo;
  }
});
