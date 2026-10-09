import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleGenerator } from "../../../../../src/game/generator/castle/CastleGenerator.js";
import { CastleResidentialLayout } from "../../../../../src/game/objects/castle/CastleResidentialLayout.js";

it("supports stepping from the first authored tread onto its floor in either mirror orientation", async () => {
  for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
    for (const seed of [0, 1]) {
      const plan = await CastleGenerator.generate({
        position: { x: -14, z: -8, width: 28, depth: 16, elevation: 3 },
        doors: [{ side, offset: 13, width: 2 }], seed,
      });
      const layout = new CastleResidentialLayout(plan);
      for (const stair of layout.authoredStairs) {
        const angle = stair.yaw * Math.PI / 180;
        const across = -stair.radius / 2 - (stair.flightGap ?? 0) / 2;
        const along = stair.radius + (stair.flightShift ?? 0) + 0.2;
        const x = stair.center.x + across * Math.cos(angle) + along * Math.sin(angle);
        const z = stair.center.z - across * Math.sin(angle) + along * Math.cos(angle);
        assert.equal(layout.surfaceHeightAt(x, z, stair.center.y + 0.3), stair.center.y,
          `${side}/${seed}/${stair.id}: the first tread can reach the adjoining floor`);
        assert.equal(layout.surfaceHeightAt(x, z, stair.center.y + 0.33), null,
          "floor support rejects levels outside the automatic step clearance");
      }
    }
  }
});

