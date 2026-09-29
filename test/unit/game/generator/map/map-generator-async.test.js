import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateMap } from "../../../../../src/game/generator/map/MapGenerator.js";
import { PathOutsideGateError } from "../../../../../src/game/errors/map/index.js";

describe("async map generation", () => {
  it("yields to the event loop before resolving", async () => {
    let timerFired = false;
    const pendingMap = generateMap({ mapName: "async-yield" });

    assert.ok(pendingMap instanceof Promise);
    setTimeout(() => {
      timerFired = true;
    }, 0);

    const map = await pendingMap;

    assert.equal(timerFired, true);
    assert.equal(map.mapName, "async-yield");
  });

  it("keeps concurrent seeded requests deterministic", async () => {
    const [first, second] = await Promise.all([
      generateMap({ mapName: "async-concurrent-first" }),
      generateMap({ mapName: "async-concurrent-second" }),
    ]);
    const repeatedFirst = await generateMap({
      mapName: "async-concurrent-first",
    });
    const repeatedSecond = await generateMap({
      mapName: "async-concurrent-second",
    });

    assert.deepEqual(first, repeatedFirst);
    assert.deepEqual(second, repeatedSecond);
  });

  it("retries an invalid random map with a fresh seed", async () => {
    const originalNow = Date.now;
    const originalRandom = Math.random;
    Date.now = () => 1;
    const randomValues = [36, 37];
    Math.random = () => randomValues.shift() / 0x100000000;

    try {
      const map = await generateMap();
      assert.equal(map.mapName, "1_0000011");
      assert.equal(randomValues.length, 0);
    } finally {
      Date.now = originalNow;
      Math.random = originalRandom;
    }
  });

  it("rejects an invalid named map without changing its seed", async () => {
    await assert.rejects(
      generateMap({ mapName: "1_0000010" }),
      PathOutsideGateError,
    );
  });

  it("preserves deterministic output across representative pipeline paths", async () => {
    const options = [
      { mapName: "pipeline-baseline-default" },
      { mapName: "pipeline-baseline-rivers", numPaths: 4, numRivers: 6 },
      { mapName: "pipeline-baseline-no-rivers", numPaths: 1, numRivers: 0 },
      { mapName: "pipeline-baseline-overpass", numPaths: 4, overpass: true },
    ];

    for (const generationOptions of options) {
      const first = await generateMap(generationOptions);
      const second = await generateMap(generationOptions);
      assert.deepEqual(second, first);
    }
  });
});
