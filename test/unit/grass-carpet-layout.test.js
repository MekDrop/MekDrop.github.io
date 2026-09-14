import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GrassCarpetLayout } from "../../src/game/objects/ground-cover/GrassCarpetLayout.js";
import { TileType } from "../../src/game/MapGenerator.js";
import { GRASS_SURFACE_LIFT } from "../../src/game/config/terrain.js";
import { TILE_SHAPE } from "../../src/game/enum/TileShape.js";

function map(grid) {
  return {
    grid,
    rows: grid.length,
    cols: grid[0].length,
    heightmap: grid.map((row) => row.map(() => 2)),
    tileMeta: grid.map((row) => row.map(() => ({}))),
  };
}

describe("short grass carpet placement", () => {
  it("covers grass without occupying paths, water, gates or castle foundations", () => {
    const input = map([[TileType.GRASS, TileType.PATH, TileType.WATER,
      TileType.ENTRY, TileType.CASTLE_WALL, TileType.CASTLE_TOWER]]);
    const before = structuredClone(input);
    const placements = GrassCarpetLayout.create(input);
    assert.ok(placements.length >= 100);
    assert.ok(placements.every(({ x, z }) => Math.abs(x + 2.5) < 0.5 && Math.abs(z) < 0.5));
    assert.deepEqual(input, before);
  });

  it("is deterministic and keeps the authored 0.34-unit blades below ankle height", () => {
    const input = map([[TileType.GRASS, TileType.GRASS]]);
    input.heightmap[0][1] = 4;
    const placements = GrassCarpetLayout.create(input);
    assert.deepEqual(placements, GrassCarpetLayout.create(input));
    assert.ok(new Set(placements.map(({ rotation }) => rotation)).size > 20);
    const topPlacements = placements.filter(({ edgeX, edgeZ }) => !edgeX && !edgeZ);
    assert.ok(topPlacements.every(({ height, broadleaf }) => height * (broadleaf ? 0.19 : 0.34) < 0.075));
    assert.ok(placements.some(({ broadleaf }) => broadleaf));
    assert.ok(placements.some(({ broadleaf }) => !broadleaf));
    assert.ok(topPlacements.filter(({ x }) => x > 0).every(({ y }) => y === 4 + GRASS_SURFACE_LIFT - 0.012));
  });

  it("does not put floating clumps on slopes, voids or bridge-reserved ground", () => {
    const input = map([[TileType.GRASS, TileType.GRASS, TileType.GRASS]]);
    input.tileMeta[0][0].shape = TILE_SHAPE.SLOPE;
    input.heightmap[0][1] = 0;
    input.tileMeta[0][2].renderMode = "BRIDGE";
    assert.deepEqual(GrassCarpetLayout.create(input), []);
  });

  it("grows on the solid source cover at its terrain height, keeping the downstream water clear", () => {
    const input = map([[TileType.WATER, TileType.WATER]]);
    input.heightmap[0] = [0, 0];
    input.riverData = [{ cells: [
      { col: 0, row: 0, terrainHeight: 3 },
      { col: 1, row: 0, terrainHeight: 2 },
    ] }];
    const placements = GrassCarpetLayout.create(input);
    assert.ok(placements.length >= 100);
    assert.ok(placements.every(({ x, y }) => x < 0 && y > 3 && y < 3 + GRASS_SURFACE_LIFT));
  });

  it("scatters freely across the tile and changes the arrangement with the map seed", () => {
    const input = map([[TileType.GRASS]]);
    const placements = GrassCarpetLayout.create({ ...input, mapName: "lawn-a" })
      .filter(({ edgeX, edgeZ }) => !edgeX && !edgeZ);
    const otherSeed = GrassCarpetLayout.create({ ...input, mapName: "lawn-b" })
      .filter(({ edgeX, edgeZ }) => !edgeX && !edgeZ);
    assert.notDeepEqual(placements, otherSeed);
    assert.equal(new Set(placements.map(({ x }) => x)).size, placements.length);
    assert.equal(new Set(placements.map(({ z }) => z)).size, placements.length);
    for (const signX of [-1, 1]) {
      for (const signZ of [-1, 1]) {
        assert.ok(placements.filter(({ x, z }) => x * signX > 0 && z * signZ > 0).length > 15);
      }
    }
  });

  it("adds a hanging fringe only on exposed edges and never toward paths", () => {
    const input = map([[TileType.GRASS, TileType.GRASS, TileType.PATH]]);
    input.heightmap[0] = [2, 3, 1];
    const fringe = GrassCarpetLayout.create(input).filter(({ edgeX, edgeZ }) => edgeX || edgeZ);
    assert.ok(fringe.some(({ x, edgeX }) => x > -0.5 && x < 0.5 && edgeX === -1));
    assert.ok(!fringe.some(({ x, edgeX }) => x > -0.5 && x < 0.5 && edgeX === 1));
    assert.ok(!fringe.some(({ x, edgeX }) => x < -0.5 && edgeX === 1));
  });
});
