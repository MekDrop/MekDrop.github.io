import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleAuthoredBuildPlan } from "../../../../../src/game/generator/castle/CastleAuthoredBuildPlan.js";
import { castleStraightStairSurfaces } from "../../../../../src/game/objects/castle/CastleStraightStairs.js";

it("cuts every floor slab to the rear stairwell wall in all gate orientations", async () => {
  for (const side of ["NORTH", "SOUTH", "EAST", "WEST"]) {
    const plan = await CastleAuthoredBuildPlan.generate({
      basePlanId: "castle-demo-compact",
      position: { x: -14, z: -8, width: 28, depth: 16, elevation: 3 },
      doors: [{ side, offset: 5, width: 2 }], seed: 1,
    });
    for (const stair of plan.metadata.runtime.residential.authoredStairs) {
      const turning = castleStraightStairSurfaces(stair)[1];
      const angle = stair.yaw * Math.PI / 180;
      for (const across of [-stair.radius / 2, 0, stair.radius / 2]) {
        const along = turning.minZ + 0.06;
        const x = stair.center.x + across * Math.cos(angle) + along * Math.sin(angle);
        const z = stair.center.z - across * Math.sin(angle) + along * Math.cos(angle);
        const y = stair.center.y + stair.rise - 0.125;
        assert.ok(!plan.geometry.boxes.some(box => Math.abs(x - box.x) < box.sx / 2 - 1e-6 &&
          Math.abs(y - box.y) < box.sy / 2 - 1e-6 && Math.abs(z - box.z) < box.sz / 2 - 1e-6),
        `${side}/${stair.id}: no slab shelf behind the turning landing`);
      }
    }
  }
});
