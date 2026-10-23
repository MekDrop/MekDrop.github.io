import assert from "node:assert/strict";
import { test } from "node:test";
import { CastleAuthoredBuildPlan } from "../../../../../src/game/generator/castle/CastleAuthoredBuildPlan.js";
import { CastleGenerationScheduler } from "../../../../../src/game/generator/castle/CastleGenerationScheduler.js";

test("masonry generation yields repeatedly without changing the generated plan", async () => {
  const options = {
    seed: 1,
    position: {
      x: -14,
      z: -8,
      width: 28,
      depth: 16,
      elevation: 3,
    },
    doors: [{
      side: "NORTH",
      offset: 7,
      width: 2,
    }],
  };
  const expected = await CastleAuthoredBuildPlan.generate(options);
  let yields = 0;
  class Scheduler extends CastleGenerationScheduler {
    async yieldToMainThread() {
      yields += 1;
      await Promise.resolve();
    }
  }
  const actual = await CastleAuthoredBuildPlan.generate({
    ...options,
    scheduler: new Scheduler({ frameBudgetMs: 0 }),
  });
  delete actual.input.scheduler;
  assert.ok(yields > 10, "masonry must not be emitted in one blocking pass");
  assert.deepEqual(actual, expected);
});
