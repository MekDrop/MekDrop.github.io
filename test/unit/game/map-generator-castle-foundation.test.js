import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MapGenerator, TileType } from "../../../src/game/MapGenerator.js";
import { GrassCarpetLayout } from "../../../src/game/objects/ground-cover/GrassCarpetLayout.js";

describe("MapGenerator castle foundation", () => {
  it("keeps grass outside the castle footprint", async () => {
    const map = await MapGenerator.generate({
      mapName: "dirt-foundation",
      numPaths: 3,
      numRivers: 0,
    });
    const { col, row, width, depth } = map.castle.position;
    const surroundingGrass = [];

    for (let currentRow = row - 1; currentRow <= row + depth; currentRow += 1) {
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
        assert.equal(map.tileMeta[currentRow][currentCol].surfaceType, "GRASS");
      }
    }

    assert.ok(surroundingGrass.length > 0);

    const rearCol = col + width;
    const rearGrass = GrassCarpetLayout.create(map).filter(
      ({ castleRearGrass }) => castleRearGrass,
    );
    assert.equal(rearGrass.length, depth * 72);
    for (let currentRow = row; currentRow < row + depth; currentRow += 1) {
      assert.equal(map.grid[currentRow][rearCol], TileType.GRASS);
      assert.equal(
        map.heightmap[currentRow][rearCol],
        map.castle.position.elevation,
      );
    }
  });

  it("keeps the enlarged single-tower castle inside its full foundation", async () => {
    const map = await MapGenerator.generate({ mapName: "mug3qf6a_0z7fnua" });
    const { col, row, width, depth } = map.castle.position;
    const grass = GrassCarpetLayout.create(map);

    assert.equal(map.castle.style, "single-tower");
    for (let currentRow = row; currentRow < row + depth; currentRow += 1) {
      for (let currentCol = col; currentCol < col + width; currentCol += 1) {
        const tile = map.grid[currentRow][currentCol];
        assert.ok(
          tile === TileType.CASTLE_WALL ||
            tile === TileType.CASTLE_TOWER ||
            tile === TileType.PATH,
        );
        if (tile !== TileType.PATH) {
          assert.equal(
            map.tileMeta[currentRow][currentCol].surfaceType,
            "STRUCTURE",
          );
        }
      }
    }
    assert.ok(
      grass.every(
        ({ x, z }) =>
          x < col - (map.cols - 1) / 2 - 0.5 ||
          x >= col + width - (map.cols - 1) / 2 - 0.5 ||
          z < row - (map.rows - 1) / 2 - 0.5 ||
          z >= row + depth - (map.rows - 1) / 2 - 0.5,
      ),
    );
  });

  it("authors the royal and servant as independent map objects", async () => {
    const map = await MapGenerator.generate({
      mapName: "castle-resident-objects",
      numPaths: 3,
      numRivers: 0,
    });
    const residents = map.objects.filter(({ object }) =>
      ["King", "Queen", "Princess", "Servant"].includes(object),
    );

    assert.equal(residents.length, 2);
    assert.ok(["King", "Queen", "Princess"].includes(residents[0].object));
    assert.equal(residents[0].castleIndex, 0);
    assert.equal(residents[1].object, "Servant");
    assert.equal(residents[1].castleIndex, 0);
  });
});
