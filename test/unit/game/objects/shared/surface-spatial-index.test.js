import assert from "node:assert/strict";
import { it } from "node:test";
import { SurfaceSpatialIndex } from "../../../../../src/game/objects/shared/SurfaceSpatialIndex.js";

it("keeps all overlapping surfaces across negative coordinates and cell boundaries", () => {
  const index = new SurfaceSpatialIndex();
  const entries = [];
  for (let x = -20; x <= 20; x += 2) {
    const bounds = {
      minX: x - 1.5,
      maxX: x + 1.5,
      minZ: -1.5,
      maxZ: 1.5,
    };
    const item = { surfaceHeightAt: () => 1 };
    entries.push({
      item,
      bounds,
    });
    index.add(item, bounds);
  }
  for (let x = -22; x <= 22; x += 0.5) {
    for (const radius of [0, 0.3, 2, 5]) {
      const candidates = index.query(x, 0, radius);
      for (const { item, bounds } of entries) {
        if (bounds.maxX >= x - radius && bounds.minX <= x + radius) {
          assert.ok(candidates.has(item), "broad phase must not omit an overlapping surface");
        }
      }
    }
  }
  assert.ok(index.query(0, 0).size < entries.length);
  assert.equal(index.query(100, 100).size, 0);
});

it("deduplicates providers spanning multiple cells and retains live provider state", () => {
  const index = new SurfaceSpatialIndex();
  let height = 3;
  const item = { surfaceHeightAt: () => height };
  index.add(item, {
    minX: -8,
    maxX: 8,
    minZ: -8,
    maxZ: 8,
  });
  const candidates = index.query(0, 0, 10);
  assert.equal(candidates.size, 1);
  height = null;
  assert.equal([...candidates][0].surfaceHeightAt(), null);
});
