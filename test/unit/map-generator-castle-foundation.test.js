import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MapGenerator, TileType } from "../../src/game/MapGenerator.js";

describe("MapGenerator castle foundation", () => {
  it("keeps grass outside the castle footprint", () => {
    const map = MapGenerator.generate({
      mapName: "dirt-foundation",
      numPaths: 3,
      numRivers: 0,
    });
    const { col, row, width, depth } = map.castle.position;
    const surroundingGrass = [];

    for (
      let currentRow = row - 1;
      currentRow <= row + depth;
      currentRow += 1
    ) {
      for (
        let currentCol = col - 2;
        currentCol <= col + width;
        currentCol += 1
      ) {
        const insideCastle =
          currentCol >= col &&
          currentCol < col + width &&
          currentRow >= row &&
          currentRow < row + depth;
        if (
          insideCastle ||
          map.grid[currentRow]?.[currentCol] !== TileType.GRASS
        ) {
          continue;
        }
        surroundingGrass.push(`${currentCol},${currentRow}`);
        assert.equal(
          map.tileMeta[currentRow][currentCol].surfaceType,
          "GRASS",
        );
      }
    }

    assert.ok(surroundingGrass.length > 0);
  });
});
