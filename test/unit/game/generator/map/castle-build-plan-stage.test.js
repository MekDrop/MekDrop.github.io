import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CastleBuildPlanStage } from "../../../../../src/game/generator/map/stages/CastleBuildPlanStage.js";

describe("CastleBuildPlanStage", () => {
  it("adds a generated castle plan to the map-generation output", async () => {
    const calls = [];
    const buildPlan = { geometry: { boxes: [{ id: "wall" }] } };
    const stage = new CastleBuildPlanStage({
      mapDimensions: { cols: 42, rows: 42 },
      generateCastleBuildPlan: async (options) => {
        calls.push(options);
        return buildPlan;
      },
    });
    const castle = {
      position: { col: 33, row: 17, width: 5, depth: 7, elevation: 3 },
      style: "twin-tower",
      doors: [
        {
          side: "WEST",
          offset: 2,
          width: 2,
          cells: [
            { col: 33, row: 19 },
            { col: 33, row: 20 },
          ],
        },
      ],
    };
    const context = {
      world: {
        heightmap: Array.from({ length: 42 }, () => new Array(42).fill(2)),
      },
      output: { castle },
    };
    context.world.heightmap[20][33] = 2.5;

    await stage.run(context);

    assert.equal(context.output.castleBuildPlan, buildPlan);
    assert.deepEqual(calls, [
      {
        position: {
          x: 12,
          z: -4,
          width: 5,
          depth: 7,
          elevation: 3,
        },
        doors: [
          {
            side: "WEST",
            offset: 2,
            width: 2,
            approachElevation: 2.5,
          },
        ],
        requestedStyle: "twin-tower",
        seed: "map:castle:33:17",
      },
    ]);
  });
});
