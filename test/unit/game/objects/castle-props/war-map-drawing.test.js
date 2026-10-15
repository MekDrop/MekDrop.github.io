import assert from "node:assert/strict";
import { test } from "node:test";
import { WarMapDrawing } from "../../../../../src/game/objects/castle-props/WarMapDrawing.js";

test("parchment reflects current roads, rivers and castle tiles without changing the world", () => {
  const map = {
    cols: 3,
    rows: 3,
    grid: [[0, 1, 2], [1, 1, 1], [1, 1, 1]],
    heightmap: [[0, 0, 0], [0, 4, 0], [0, 0, 0]],
    riverData: [{
      cells: [{
        col: 2,
        row: 2,
      }],
    }],
    objects: [{
      object: "Castle",
      tile: {
        col: 0,
        row: 2,
      },
    }],
  };
  const before = structuredClone(map);
  const raster = WarMapDrawing.raster(map, 64);
  const sample = (x, y) => [...raster.pixels.slice((y * 64 + x) * 4, (y * 64 + x) * 4 + 3)];
  assert.deepEqual(sample(20, 20), [88, 136, 154]);
  assert.deepEqual(sample(44, 20), [149, 108, 66]);
  assert.deepEqual(sample(44, 44), [88, 136, 154]);
  assert.deepEqual(sample(20, 44), [165, 53, 46]);
  assert.notDeepEqual(sample(32, 32), sample(32, 20));
  assert.deepEqual(map, before);
  map.grid[0][2] = 1;
  assert.notDeepEqual(WarMapDrawing.raster(map, 64).pixels, raster.pixels);
});
