import assert from "node:assert/strict";
import { test } from "node:test";
import { VestibuleIslandFurnishing } from "../../../../../src/game/generator/castle/rooms/vestibule/VestibuleIslandFurnishing.js";
import { WarMapDrawing } from "../../../../../src/game/objects/war-map-drawing/WarMapDrawing.js";

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

test("places a separate drawing above the map table in either room orientation", () => {
  for (const alongX of [true, false]) {
    const items = VestibuleIslandFurnishing.furnish({
      id: "arrival",
      level: 0,
      minX: 0,
      minZ: 0,
      maxX: alongX ? 7 : 4,
      maxZ: alongX ? 4 : 7,
      furnishingSeed: 6,
    }, [], () => true, 0.25);
    const table = items.find(item => item.object === "Table");
    const drawing = items.find(item => item.object === "WarMapDrawing");
    assert.ok(table);
    assert.ok(drawing);
    assert.notEqual(table.id, drawing.id);
    assert.equal(drawing.x, table.x);
    assert.equal(drawing.z, table.z);
    assert.equal(drawing.rotation, table.rotation);
    assert.ok(Math.abs(drawing.y - table.y - table.height - 0.003) < 1e-6);
    assert.ok(drawing.width < table.width && drawing.depth < table.depth);
    assert.equal(drawing.properties.width, 1.35);
    assert.equal(drawing.properties.depth, 0.69);
  }
});
