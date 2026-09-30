import assert from "node:assert/strict";
import { it } from "node:test";
import { DecorationPlacementRules } from "../../../../../src/game/generator/map/DecorationPlacementRules.js";
import { MapGrid } from "../../../../../src/game/generator/map/MapGrid.js";
import { MAP_TILE_TYPE } from "../../../../../src/game/enum/MapTileType.js";
import { TILE_SHAPE } from "../../../../../src/game/enum/TileShape.js";

it("requires level ground around vegetation, including diagonal support", () => {
  const grid = MapGrid.createGrid(MAP_TILE_TYPE.GRASS);
  const heights = MapGrid.createGrid(3);
  const metadata = MapGrid.createTileMetadata();
  const layout = { castleLeft: 30, castleRight: 35, castleTop: 30, castleBottom: 35 };
  const eligible = () => DecorationPlacementRules.isVegetationCandidate(
    grid, heights, metadata, layout, 10, 10,
  );
  assert.equal(eligible(), true);
  for (let row = 9; row <= 11; row++) {
    for (let col = 9; col <= 11; col++) {
      if (col === 10 && row === 10) {
        continue;
      }
      heights[row][col] = 2;
      assert.equal(eligible(), false);
      heights[row][col] = 3;
    }
  }
  grid[10][11] = MAP_TILE_TYPE.WATER;
  assert.equal(eligible(), false);
  grid[10][11] = MAP_TILE_TYPE.GRASS;
  metadata[10][11].shape = TILE_SHAPE.SLOPE;
  assert.equal(eligible(), false);
  assert.equal(DecorationPlacementRules.isVegetationCandidate(
    grid, heights, metadata, layout, 0, 10,
  ), false);
});
