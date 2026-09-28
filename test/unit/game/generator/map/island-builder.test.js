import assert from "node:assert/strict";
import { it } from "node:test";

import { IslandBuilder } from "../../../../../src/game/generator/map/IslandBuilder.js";
import { MapGrid } from "../../../../../src/game/generator/map/MapGrid.js";
import { TileType } from "../../../../../src/game/generator/map/MapGenerator.js";

it("repairs enclosed holes consistently in every terrain artifact", () => {
  const grid = MapGrid.createGrid(TileType.WATER);
  const heights = MapGrid.createGrid(0);
  const mask = MapGrid.createGrid(false);
  const metadata = MapGrid.createTileMetadata();
  for (const [col, row] of [[5, 4], [5, 6], [4, 5], [6, 5]]) {
    grid[row][col] = TileType.GRASS;
    mask[row][col] = true;
  }
  new IslandBuilder().materializeSingleCellTerrainHoles(grid, metadata, mask, heights);
  assert.equal(grid[5][5], TileType.GRASS);
  assert.equal(heights[5][5], 1);
  assert.equal(mask[5][5], true);
  assert.equal(metadata[5][5].surfaceType, "GRASS");
  assert.equal(metadata[5][5].baseHeight, 1);
  assert.equal(grid[0][0], TileType.WATER);
});
