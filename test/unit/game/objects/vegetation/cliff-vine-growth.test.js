import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCliffVineGrowth } from "../../../../../src/game/objects/vegetation/CliffVineGrowth.js";

describe("cliff-owned ivy growth", () => {
  it("keeps the same patch stable and varies different patches", () => {
    const patch = createCliffVineGrowth({ height: 2, seed: "face-a" });
    assert.deepEqual(patch, createCliffVineGrowth({ height: 2, seed: "face-a" }));
    assert.notDeepEqual(patch, createCliffVineGrowth({ height: 2, seed: "face-b" }));
  });
  it("reaches the bottom of short faces while keeping slightly uneven tips", () => {
    const patch = createCliffVineGrowth({ height: 0.975, seed: "short-cliff" });
    const tips = patch.stems.filter(({ end }, index) => index === patch.stems.length - 1 || patch.stems[index + 1].start.z < 0).map(({ end }) => -end.y);
    assert.ok(tips.length >= 2);
    assert.ok(tips.every((tip) => tip >= 0.975 * 0.91 && tip < 0.975));
    assert.ok(Math.max(...tips) >= 0.975 * 0.98);
  });
  it("adds growth on tall faces without stretching leaves", () => {
    const short = createCliffVineGrowth({ height: 0.6, seed: "face" });
    const tall = createCliffVineGrowth({ height: 8, seed: "face" });
    assert.ok(tall.leaves.length > short.leaves.length * 5);
    for (const [height, patch] of [[0.6, short], [8, tall]]) {
      assert.ok(patch.leaves.length > 0);
      assert.ok(patch.leaves.every(({ scale, y }) => scale >= 0.78 && scale <= 1.08 && y <= 0 && y > -height));
      assert.ok(patch.stems.every(({ start, end }) => start.y >= -height && end.y >= -height));
      assert.ok(patch.stems.some(({ start }) => start.z < 0));
    }
  });
});
