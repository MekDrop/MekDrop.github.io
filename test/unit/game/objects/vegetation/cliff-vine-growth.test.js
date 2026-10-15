import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Quat, Vec3 } from "playcanvas";
import { createCliffVineGrowth } from "../../../../../src/game/objects/vegetation/CliffVineGrowth.js";

describe("cliff-owned ivy growth", () => {
  it("keeps leaf geometry against the wall and within its supporting tile", () => {
    // The shipped leaf's local bounds, including its cupped surface.
    for (let seed = 0; seed < 30; seed++) {
      const patch = createCliffVineGrowth({
        height: 8,
        seed: `wall-${seed}`,
      });
      for (const leaf of patch.leaves) {
        const rotation = new Quat().setFromEulerAngles(leaf.pitch, leaf.yaw, leaf.roll);
        for (const x of [-0.0754, 0.0754]) {
          for (const y of [-0.145, 0.003625]) {
            for (const z of [-0.006, 0.03]) {
              const point = rotation.transformVector(new Vec3(x, y, z).mulScalar(leaf.scale));
              assert.ok(Math.abs(point.x + leaf.x) + 0.12 < 0.5);
              assert.ok(point.z + leaf.z + 0.502 <= 0.535);
              assert.ok(point.y + leaf.y > -8);
            }
          }
        }
      }
    }
  });
  it("keeps the same patch stable and varies different patches", () => {
    const patch = createCliffVineGrowth({
      height: 2,
      seed: "face-a",
    });
    assert.deepEqual(patch, createCliffVineGrowth({
      height: 2,
      seed: "face-a",
    }));
    assert.notDeepEqual(patch, createCliffVineGrowth({
      height: 2,
      seed: "face-b",
    }));
  });
  it("reaches the bottom of short faces while keeping slightly uneven tips", () => {
    const patch = createCliffVineGrowth({
      height: 0.975,
      seed: "short-cliff",
    });
    const tips = patch.stems.filter(({ end }, index) => index === patch.stems.length - 1 || patch.stems[index + 1].start.z < 0).map(({ end }) => -end.y);
    assert.ok(tips.length >= 2);
    assert.ok(tips.every((tip) => tip >= 0.975 * 0.91 && tip < 0.975));
    assert.ok(Math.max(...tips) >= 0.975 * 0.98);
  });
  it("adds growth on tall faces without stretching leaves", () => {
    const short = createCliffVineGrowth({
      height: 0.6,
      seed: "face",
    });
    const tall = createCliffVineGrowth({
      height: 8,
      seed: "face",
    });
    assert.ok(tall.leaves.length > short.leaves.length * 5);
    const roots = tall.stems.filter(({ start }) => start.z < 0);
    assert.ok(roots.length >= 2 && roots.length <= 3);
    assert.ok(Math.max(...tall.stems.map(({ end }) => -end.y)) >= 8 * 0.97);

    for (const [height, patch] of [[0.6, short], [8, tall]]) {
      assert.ok(patch.leaves.length > 0);
      assert.ok(patch.leaves.every(({ scale, y }) => scale >= 0.78 && scale <= 1.08 && y <= 0 && y > -height));
      assert.ok(patch.stems.every(({ start, end }) => start.y >= -height && end.y >= -height));
      assert.ok(patch.stems.some(({ start }) => start.z < 0));
    }
  });
});
