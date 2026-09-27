import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateMap } from "../../../src/game/MapGenerator.js";

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
});
