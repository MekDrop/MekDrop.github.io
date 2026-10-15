import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { ClothWindExposure } from "../../../../../src/game/objects/shared/ClothWindExposure.js";

it("updates exposure when collision opens, closes, or partly obstructs the upwind path", () => {
  const root = new pc.Entity();
  root.setPosition(4, 3, 2);
  root.setEulerAngles(0, 90, 0);
  const rays = [];
  let blocked = true;
  const app = {
    systems: {
      rigidbody: {
        raycastFirst(start, end) {
          rays.push({
            start: start.clone(),
            end: end.clone(),
          });
          return blocked ? {} : null;
        },
      },
    },
  };
  const exposure = new ClothWindExposure({
    pc,
    app,
    root,
    width: 1,
    height: 2,
  });
  assert.equal(exposure.sample({
    x: 1,
    y: 0,
    z: 0,
  }, 0), 0);
  assert.equal(rays.length, 3);
  for (const ray of rays) {
    assert.equal(ray.start.y, 2);
    assert.equal(ray.end.x, ray.start.x - 64);
    assert.equal(ray.end.z, ray.start.z);
  }
  blocked = false;
  assert.equal(exposure.sample({
    x: 1,
    y: 0,
    z: 0,
  }, 0.05), 0);
  assert.equal(rays.length, 3, "cache bounds raycast work between updates");
  assert.equal(exposure.sample({
    x: 1,
    y: 0,
    z: 0,
  }, 0.11), 1);
  blocked = true;
  assert.equal(exposure.sample({
    x: -1,
    y: 0,
    z: 0,
  }, 0.22), 0);
  app.systems.rigidbody.raycastFirst = (start) => start.z > 2 ? {} : null;
  assert.ok(exposure.sample({
    x: 1,
    y: 0,
    z: 0,
  }, 0.33) > 0);
  assert.ok(exposure.sample({
    x: 1,
    y: 0,
    z: 0,
  }, 0.33) < 1);
  root.destroy();
});
