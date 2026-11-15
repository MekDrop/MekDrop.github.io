import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleGenerator } from "../../../../../src/game/generator/castle/CastleGenerator.js";

it("creates a royal activity for the side-tower terrace in every castle orientation", async () => {
  for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
    const plan = await CastleGenerator.generate({
      basePlanId: "castle-compact-service-wing",
      seed: 3680593266,
      position: {
        x: 9,
        z: 0,
        width: 10,
        depth: 15,
        elevation: 3,
      },
      doors: [{
        side,
        offset: 4,
        width: 2,
      }],
    });
    const terrace = plan.metadata.runtime.terrace;
    assert.ok(terrace, `${side}: royal activity must exist`);
    assert.equal(terrace.doorRoomId, "upper-stair-room");
    assert.ok(terrace.width > 0 && terrace.depth > 0);
    assert.ok(Number.isFinite(terrace.yaw));
  }
});
