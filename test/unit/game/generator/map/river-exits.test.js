import assert from "node:assert/strict";
import { it } from "node:test";
import { RiverPlacementRules } from "../../../../../src/game/generator/map/RiverPlacementRules.js";
import { MapGenerator } from "../../../../../src/game/generator/map/MapGenerator.js";

it("rejects river exits into holes and notches with land beyond them", () => {
  const mask = Array.from({ length: 42 }, () => Array(42).fill(false));
  mask[20][20] = true;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    assert.equal(RiverPlacementRules.hasClearRiverExit(mask, 20, 20, dx, dy), true);
    mask[20 + dy * 3][20 + dx * 3] = true;
    assert.equal(RiverPlacementRules.hasClearRiverExit(mask, 20, 20, dx, dy), false);
    mask[20 + dy * 3][20 + dx * 3] = false;
  }
});

it("gives map 69 a river outlet with no island terrain beyond its lip", async () => {
  const map = await MapGenerator.generate({ mapName: "69" });
  assert.ok(map.riverData.length);
  for (const river of map.riverData) {
    const last = river.cells.at(-1);
    const previous = river.cells.at(-2);
    const dx = last.col - previous.col;
    const dy = last.row - previous.row;
    for (let col = last.col + dx, row = last.row + dy;
      col >= 0 && col < map.grid[0].length && row >= 0 && row < map.grid.length;
      col += dx, row += dy) {
      assert.equal(map.heightmap[row][col], 0, `land beyond ${river.id} at ${col},${row}`);
    }
  }
});
