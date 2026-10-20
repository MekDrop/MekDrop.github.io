import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import { ObjectDataCache } from "../../../../src/game/cache/ObjectDataCache.js";
import { CastleGenerator } from "../../../../src/game/generator/castle/CastleGenerator.js";
import { CastleAuthoredBuildPlan } from "../../../../src/game/generator/castle/CastleAuthoredBuildPlan.js";
import { CastleGenerationAbortedError } from "../../../../src/game/errors/castle/index.js";

const originalData = ObjectDataCache.data;
const originalGenerate = CastleAuthoredBuildPlan.generate;
const map = JSON.parse(readFileSync(new URL("../../../../src/game/maps/tests/castle-seeds.json", import.meta.url), "utf8"));
const castle = map.objects.find((definition) => definition.object === "Castle");
const options = {
  basePlanId: castle.basePlanId,
  position: castle.position,
  doors: castle.doors,
  seed: castle.seed,
};
afterEach(() => {
  ObjectDataCache.finishRecording();
  ObjectDataCache.data = originalData;
  CastleGenerator.cacheEnabled = true;
  CastleAuthoredBuildPlan.generate = originalGenerate;
});

test("compiled castle plans round trip through JSON and skip construction with private copies", async () => {
  ObjectDataCache.beginRecording();
  const expected = await CastleGenerator.generate(options);
  assert.equal(Object.hasOwn(expected.input, "scheduler"), false);
  ObjectDataCache.data = JSON.parse(JSON.stringify(ObjectDataCache.finishRecording()));
  CastleAuthoredBuildPlan.generate = () => assert.fail("castle construction ran on a hit");
  const actual = await CastleGenerator.generate(options);
  assert.deepEqual(actual, JSON.parse(JSON.stringify(expected)));
  actual.geometry.boxes.length = 0;
  actual.input.position.x += 100;
  assert.deepEqual(await CastleGenerator.generate(options), JSON.parse(JSON.stringify(expected)));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(CastleGenerator.generate({
    ...options,
    signal: controller.signal,
  }), CastleGenerationAbortedError);
});

test("castle toggle bypasses baked plans and keys cover placement, doors, seed, plan, and style", async () => {
  ObjectDataCache.beginRecording();
  await CastleGenerator.generate(options);
  ObjectDataCache.data = ObjectDataCache.finishRecording();
  let calls = 0;
  CastleAuthoredBuildPlan.generate = async (input) => {
    calls++;

    return originalGenerate.call(CastleAuthoredBuildPlan, input);
  };
  await CastleGenerator.generate(options);
  assert.equal(calls, 0);
  CastleGenerator.cacheEnabled = false;
  await CastleGenerator.generate(options);
  assert.equal(calls, 1);
  CastleGenerator.cacheEnabled = true;
  for (const changed of [
    { seed: String(options.seed) + "-other" },
    { requestedStyle: "other" },
    {
      position: {
        ...options.position,
        x: options.position.x + 1,
      },
    },
    {
      doors: options.doors.map((door) => ({
        ...door,
        offset: door.offset + 0.25,
      })),
    },
    { basePlanId: "invalid-plan" },
  ]) {
    try {
      await CastleGenerator.generate({
        ...options,
        ...changed,
      });
    } catch {
      // Invalid plan inputs must reach normal validation instead of hitting cache.
    }
  }
  assert.equal(calls, 6);
});

test("failed async recipes are not recorded and recording bypasses existing plans", async () => {
  const input = { seed: "async-failure" };
  ObjectDataCache.beginRecording();
  await assert.rejects(ObjectDataCache.resolveAsync("castle-plans", input, async () => {
    throw new TypeError("test generation failure");
  }));
  assert.deepEqual(ObjectDataCache.finishRecording().entries, {});
  ObjectDataCache.beginRecording();
  await ObjectDataCache.resolveAsync("castle-plans", input, async () => 1);
  ObjectDataCache.data = ObjectDataCache.finishRecording();
  ObjectDataCache.beginRecording();
  assert.equal(await ObjectDataCache.resolveAsync("castle-plans", input, async () => 2), 2);
  assert.equal(ObjectDataCache.finishRecording().entries["castle-plans"][ObjectDataCache.key(input)], 2);
});
