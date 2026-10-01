import assert from "node:assert/strict";
import { it } from "node:test";
import { DecorationPlacementRules } from "../../../../../src/game/generator/map/DecorationPlacementRules.js";
import { MapGrid } from "../../../../../src/game/generator/map/MapGrid.js";
import { MAP_TILE_TYPE } from "../../../../../src/game/enum/MapTileType.js";
import { TILE_SHAPE } from "../../../../../src/game/enum/TileShape.js";

it("requires level ground around vegetation, including diagonal support", () => {
  const grid = MapGrid.createGrid(MAP_TILE_TYPE.GRASS);
  const heights = MapGrid.createGrid(3);
  const metadata = MapGrid.createTileMetadata().map((row) => row.map((tile) => ({ ...tile, surfaceType: "GRASS" })));
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

it("flowers and mushrooms require grass surface even when cell ownership remains grass", () => {
  const grid = MapGrid.createGrid(MAP_TILE_TYPE.GRASS);
  const heights = MapGrid.createGrid(3);
  const metadata = MapGrid.createTileMetadata().map((row) => row.map((tile) => ({ ...tile, surfaceType: "GRASS" })));
  const eligible = () => DecorationPlacementRules.isGroundCoverCandidate(
    grid, heights, metadata, 10, 10,
  );
  assert.equal(eligible(), true);
  for (const surfaceType of ["EARTH", "PATH", "STRUCTURE", "WATER"]) {
    metadata[10][10].surfaceType = surfaceType;
    assert.equal(eligible(), false, surfaceType);
  }
  metadata[10][10].surfaceType = "GRASS";
  assert.equal(eligible(), true);
  grid[10][10] = MAP_TILE_TYPE.PATH;
  assert.equal(eligible(), false);
});

it("rejects stale floral placements over soil cleared for castle stairs", () => {
  const grid = MapGrid.createGrid(MAP_TILE_TYPE.GRASS);
  const heights = MapGrid.createGrid(3);
  const metadata = MapGrid.createTileMetadata().map((row) => row.map((tile) => ({ ...tile, surfaceType: "GRASS" })));
  const decorations = [
    { col: 10, row: 10, variant: "pink-flower-patch" },
    { col: 11, row: 10, variant: "red-mushroom" },
    { col: 12, row: 10, variant: "golden-mushroom-pair" },
  ];
  heights[10][10] = 1;
  heights[10][11] = 1;
  metadata[10][10] = { ...metadata[10][10], surfaceType: "EARTH", baseHeight: 1 };
  metadata[10][11] = { ...metadata[10][11], surfaceType: "EARTH", baseHeight: 1 };
  const visible = decorations.filter(({ col, row }) =>
    DecorationPlacementRules.isGroundCoverCandidate(grid, heights, metadata, col, row),
  );
  assert.deepEqual(visible, [decorations[2]]);
});
