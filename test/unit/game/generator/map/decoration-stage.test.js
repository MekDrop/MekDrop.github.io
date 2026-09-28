import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DecorationStage } from "../../../../../src/game/generator/map/stages/DecorationStage.js";

function createFixture() {
  const events = [];
  const context = {
    input: { mapName: "decoration-stage" },
    world: { grid: [], heightmap: [], tileMeta: [], islandMask: [] },
    routing: { layout: {} },
    features: { riverData: [] },
    yieldState: { lastYield: 0 },
    scheduler: { yieldIfNeeded: async () => { events.push("yield"); } },
  };
  const builder = {
    placeVegetation: () => { events.push("vegetation"); return []; },
    placeStones: () => { events.push("stones"); return []; },
    placeGroundCover: () => { events.push("cover"); return []; },
    placeCliffVines: () => { events.push("vines"); return []; },
  };
  return { events, context, stage: new DecorationStage(builder) };
}

describe("DecorationStage scheduling", () => {
  it("retains yields between placement groups", async () => {
    const { context, events, stage } = createFixture();
    await stage.run(context);
    assert.deepEqual(events, ["vegetation", "yield", "stones", "yield", "cover", "yield", "vines"]);
    assert.deepEqual(context.features.cliffVineData, []);
  });

  it("propagates scheduler interruption without placing later decorations", async () => {
    const { context, events, stage } = createFixture();
    const controller = new AbortController();
    controller.abort();
    context.scheduler.yieldIfNeeded = async () => {
      throw controller.signal.reason;
    };
    await assert.rejects(stage.run(context), (error) => error === controller.signal.reason);
    assert.deepEqual(events, ["vegetation"]);
    assert.deepEqual(context.features, { riverData: [] });
  });
});
