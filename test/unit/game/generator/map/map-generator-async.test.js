import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import { generateMap } from "../../../../../src/game/generator/map/MapGenerator.js";
import { PathOutsideGateError } from "../../../../../src/game/errors/map/index.js";

import { RouteValidator } from "../../../../../src/game/generator/map/RouteValidator.js";

describe("async map generation", () => {
  it("yields to the event loop before resolving", async () => {
    let timerFired = false;
    const pendingMap = generateMap({ mapName: "dimensioned-async-yield" });

    assert.ok(pendingMap instanceof Promise);
    setTimeout(() => {
      timerFired = true;
    }, 0);

    const map = await pendingMap;

    assert.equal(timerFired, true);
    assert.equal(map.mapName, "dimensioned-async-yield");
  });

  it("keeps concurrent seeded requests deterministic", async () => {
    const [first, second] = await Promise.all([
      generateMap({ mapName: "dimensioned-async-first" }),
      generateMap({ mapName: "1_0000014" }),
    ]);
    const repeatedFirst = await generateMap({
      mapName: "dimensioned-async-first",
    });
    const repeatedSecond = await generateMap({
      mapName: "1_0000014",
    });

    assert.deepEqual(first, repeatedFirst);
    assert.deepEqual(second, repeatedSecond);
  });

  it("retries an invalid random map with a fresh seed", async () => {
    const validate = RouteValidator.prototype.validateGatePlacement;
    let attempts = 0;
    const validation = mock.method(RouteValidator.prototype, "validateGatePlacement", function (...args) {
      if (attempts++ === 0) { throw new PathOutsideGateError(); }
      return validate.apply(this, args);
    });
    const originalNow = Date.now;
    const originalRandom = Math.random;
    Date.now = () => 1;
    const randomValues = [40, 41];
    Math.random = () => randomValues.shift() / 0x100000000;

    try {
      const map = await generateMap();
      assert.equal(map.mapName, "1_0000015");
      assert.equal(randomValues.length, 0);
    } finally {
      validation.mock.restore();
      Date.now = originalNow;
      Math.random = originalRandom;
    }
  });

  it("rejects an invalid named map without changing its seed", async () => {
    const validation = mock.method(RouteValidator.prototype, "validateGatePlacement", () => { throw new PathOutsideGateError(); });
    try {
      await assert.rejects(generateMap({ mapName: "1_0000010" }), PathOutsideGateError);
      assert.equal(validation.mock.callCount(), 1);
    } finally {
      validation.mock.restore();
    }
  });

  it("preserves deterministic output across representative pipeline paths", async () => {
    const options = [
      { mapName: "pipeline-baseline-default" },
      { mapName: "pipeline-baseline-rivers", numPaths: 4, numRivers: 6 },
      { mapName: "pipeline-baseline-no-rivers", numPaths: 1, numRivers: 0 },
      { mapName: "pipeline-baseline-overpass", numPaths: 4, overpass: true },
    ];

    for (const generationOptions of options) {
      const [first, second] = await Promise.allSettled([
        generateMap(generationOptions), generateMap(generationOptions),
      ]);
      assert.equal(second.status, first.status);
      if (first.status === "fulfilled") { assert.deepEqual(second.value, first.value); }
      else { assert.equal(second.reason.name, first.reason.name); assert.equal(second.reason.message, first.reason.message); }
    }
  });
});
