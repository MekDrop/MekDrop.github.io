import assert from "node:assert/strict";
import { it } from "node:test";
import { Entity, Vec3 } from "playcanvas";
import { CastleResidentMotion } from "../../../../../../src/game/objects/castle/residents/CastleResidentMotion.js";

it("finishes facing the doorway before walking, including the return trip", () => {
  const entity = new Entity();
  entity.setPosition(0.5, 0, 1);
  entity.setEulerAngles(0, 180, 0);
  let pose = null;
  const motion = new CastleResidentMotion({
    actor: {
      entity,
      pose: action => {
        pose = action;
      },
    },
    layout: {
      origin: { y: 0 },
      walkableAreas: [{
        minX: 0,
        maxX: 8,
        minZ: 0,
        maxZ: 2,
        floorY: 0,
      }],
      authoredStairs: [],
      stairs: null,
      toLocal: (x, z) => ({
        x,
        z,
      }),
      toWorld: (x, z, y) => ({
        x,
        y,
        z,
      }),
    },
    blocked: () => false,
    clear: () => true,
  });
  for (const x of [7.5, 0.5]) {
    motion.moveTo(new Vec3(x, 0, 1));
    let stationaryTurns = 0;
    let steps = 0;
    for (let frame = 0; frame < 200 && !motion.arrived; frame++) {
      const before = entity.getPosition().clone();
      const facingBefore = entity.forward.clone();
      motion.update(0.1);
      const cosine = Math.max(-1, Math.min(1, facingBefore.dot(entity.forward)));
      assert.ok(Math.acos(cosine) * 180 / Math.PI <= 24.01,
        "a loaded 180-degree facing must not snap through an Euler decomposition");
      const movement = entity.getPosition().clone().sub(before);
      if (movement.length() < 0.00001) {
        assert.equal(pose, "idle", "navigation pivots must not play a walking or baked root-turn clip");
        stationaryTurns++;
        continue;
      }
      const facing = entity.forward.clone().mulScalar(-1);
      assert.ok(facing.dot(movement.normalize()) >= Math.cos(15 * Math.PI / 180) - 0.001,
        "the model's authored +Z face must point along travel, not sideways or backward");
      steps++;
    }
    assert.ok(stationaryTurns > 0);
    assert.ok(steps > 0);
    assert.equal(motion.arrived, true);
  }
});
