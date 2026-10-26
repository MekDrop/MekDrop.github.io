import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { CastleResidentMotion } from "../../../../../../src/game/objects/castle/residents/CastleResidentMotion.js";
import { castleStraightStairHeight } from "../../../../../../src/game/objects/castle/stairs/CastleStraightStairs.js";

it("preserves a loaded actor's 180-degree heading instead of turning through the divider", () => {
  const entity = new pc.Entity();
  entity.setPosition(1, 0, 1.5);
  entity.setEulerAngles(0, 180, 0);
  const motion = new CastleResidentMotion({
    actor: {
      entity,
      pose: () => {},
    },
    layout: {
      origin: { y: 0 },
      walkableAreas: [{
        minX: -1,
        maxX: 3,
        minZ: -1,
        maxZ: 3,
        floorY: 0,
      }],
      authoredStairs: [],
      stairs: null,
      toLocal: (x, z) => ({
        x,
        z,
      }),
      toWorld: (x, z, y) => new pc.Vec3(x, y, z),
    },
    blocked: () => false,
    clear: () => true,
  });
  motion.moveTo(new pc.Vec3(1, 0, 0.5), "carry");
  motion.update(0.1);
  assert.ok(entity.forward.z > 0.9999, "a correct loaded heading must not be reconstructed from decomposed Euler Y");
  assert.ok(entity.getPosition().z < 1.5);
  entity.destroy();
});

for (const returning of [false, true]) {
  it(`retains cargo clearance at both landing corners while ${returning ? "descending" : "ascending"}`, () => {
    const entity = new pc.Entity();
    const bottom = new pc.Vec3(-0.6, 0, 1.4);
    const top = new pc.Vec3(0.6, 1.2, 1.4);
    entity.setPosition(returning ? top : bottom);
    entity.setEulerAngles(0, 180, 0);
    const stair = {
      center: new pc.Vec3(),
      yaw: 0,
      radius: 1.2,
      rise: 1.2,
      straight: true,
    };
    const motion = new CastleResidentMotion({
      actor: {
        entity,
        pose: () => {},
        carryTurnRadius: 0.5,
      },
      layout: {
        origin: { y: 0 },
        walkableAreas: [
          {
            minX: -1.2,
            maxX: 0,
            minZ: 1.2,
            maxZ: 2.2,
            floorY: 0,
          },
          {
            minX: 0,
            maxX: 1.2,
            minZ: 1.2,
            maxZ: 2.2,
            floorY: 1.2,
          },
        ],
        authoredStairs: [stair],
        stairs: null,
        toLocal: (x, z) => ({
          x,
          z,
        }),
        toWorld: (x, z, y) => new pc.Vec3(x, y, z),
        surfaceHeightAt: (x, z, y) => castleStraightStairHeight(stair, x, z, y),
      },
      blocked: () => false,
      clear: () => true,
    });
    motion.moveTo(returning ? bottom : top, "carry");
    let crossed = false;
    for (let frame = 0; frame < 1500 && !motion.arrived; frame++) {
      motion.update(1 / 60);
      const point = entity.getPosition();
      if (Math.abs(point.x) < 0.13) {
        crossed = true;
        assert.ok(point.z <= -1.099, `the carrying route cut the divider corner at ${point.toString()}`);
      }
    }
    assert.ok(crossed);
    assert.ok(motion.arrived);
    entity.destroy();
  });
}
