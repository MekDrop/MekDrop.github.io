import assert from "node:assert/strict";
import { test } from "node:test";
import * as pc from "playcanvas";
import Ammo from "sync-ammo/dist/ammo.module.js";
import { addGeneratedVoxelPhysics } from "../../../../../src/game/objects/shared/GeneratedVoxelPhysics.js";

test("compact compounds preserve scaled box contacts, gaps, body motion and resource ownership", () => {
  const previousAmmo = globalThis.Ammo;
  globalThis.Ammo = Ammo;
  const device = new pc.NullGraphicsDevice({
    width: 1,
    height: 1,
  });
  const app = new pc.AppBase({ id: "generated-voxel-physics" });
  app.init({
    graphicsDevice: device,
    componentSystems: [pc.CollisionComponentSystem, pc.RigidBodyComponentSystem],
    resourceHandlers: [],
  });
  app.systems.rigidbody.onLibraryLoaded();
  const world = app.systems.rigidbody.physicsWorld;
  const destroyShape = world.destroyShape.bind(world);
  let destroyed = 0;
  world.destroyShape = (shape) => {
    destroyed++;
    destroyShape(shape);
  };
  try {
    for (const yaw of [0, 90, 180, 270]) {
      const parent = new pc.Entity();
      parent.setLocalPosition(7, 3, -4);
      parent.setLocalEulerAngles(0, yaw, 0);
      parent.setLocalScale(2, 3, 4);
      const collider = addGeneratedVoxelPhysics({
        pc,
        parent,
        name: "wall with doorway",
        friction: 0.6,
        voxels: [
          {
            x: -1,
            y: 0.5,
            z: 0,
            width: 1,
            height: 1,
            depth: 1,
          },
          {
            x: 1,
            y: 1,
            z: 0,
            width: 1,
            height: 2,
            depth: 1,
          },
        ],
      });
      app.root.addChild(parent);
      assert.equal(collider.children.length, 0, "boxes do not allocate scene nodes");
      assert.equal(world.getCompoundChildCount(collider.collision.shape), 2);
      assert.equal(collider.rigidbody.friction, 0.6);
      const transform = parent.getWorldTransform();
      const point = (x, y, z) => transform.transformPoint(new pc.Vec3(x, y, z));
      const ray = (x) => app.systems.rigidbody.raycastFirst(point(x, 3, 0), point(x, -1, 0));
      assert.ok(Math.abs(ray(-1).point.y - 6) < 1e-5);
      assert.ok(Math.abs(ray(1).point.y - 9) < 1e-5);
      assert.equal(ray(0), null, "the opening stays traversable");
      parent.setLocalPosition(7, 4, -4);
      collider.rigidbody.syncEntityToBody();
      assert.ok(Math.abs(ray(-1).point.y - 7) < 1e-5);
      const before = destroyed;
      parent.destroy();
      assert.equal(destroyed - before, 3, "compound and both owned box shapes are released once");
      assert.equal(ray(-1), null);
    }
  } finally {
    app.destroy();
    globalThis.Ammo = previousAmmo;
  }
});
