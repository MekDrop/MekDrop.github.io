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
    assert.ok(placements.every(({ height, broadleaf }) => height * (broadleaf ? 0.19 : 0.34) < 0.075));
    assert.ok(placements.some(({ broadleaf }) => broadleaf));
    assert.ok(placements.some(({ broadleaf }) => !broadleaf));
    assert.ok(placements.filter(({ x }) => x > 0).every(({ y }) => y === 4 + GRASS_SURFACE_LIFT - 0.002));
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
    const placements = GrassCarpetLayout.create({ ...input, mapName: "lawn-a" });
    const otherSeed = GrassCarpetLayout.create({ ...input, mapName: "lawn-b" });
    assert.notDeepEqual(placements, otherSeed);
    assert.equal(new Set(placements.map(({ x }) => x)).size, placements.length);
    assert.equal(new Set(placements.map(({ z }) => z)).size, placements.length);
    for (const signX of [-1, 1]) {
      for (const signZ of [-1, 1]) {
        assert.ok(placements.filter(({ x, z }) => x * signX > 0 && z * signZ > 0).length > 15);
      }
    }
  });

  it("keeps the same scatter and density at a cliff as inside the lawn", () => {
    const input = map(Array.from({ length: 3 }, () => Array(3).fill(TileType.GRASS)));
    const center = (placements) => placements.filter(({ x, z }) => Math.abs(x) < 0.5 && Math.abs(z) < 0.5);
    const inside = center(GrassCarpetLayout.create(input));
    input.heightmap[1][1] = 3;
    const cliff = center(GrassCarpetLayout.create(input));
    assert.equal(cliff.length, inside.length);
    assert.deepEqual(cliff.map(({ x, z, rotation, width, height }) => [x, z, rotation, width, height]),
      inside.map(({ x, z, rotation, width, height }) => [x, z, rotation, width, height]));
    assert.ok(cliff.every(({ exposedSides }) => exposedSides === 15));
  });

  it("uses the neighboring height on every corner without adding edge rows", () => {
    for (const [closedX, closedZ, closedSide] of [[-1, 0, 0], [0, -1, 1], [1, 0, 2], [0, 1, 3]]) {
      const input = map(Array.from({ length: 3 }, () => Array(3).fill(TileType.GRASS)));
      input.heightmap[1][1] = 3;
      input.heightmap[1 + closedZ][1 + closedX] = 4;
      const center = GrassCarpetLayout.create(input)
        .filter(({ x, z }) => Math.abs(x) < 0.5 && Math.abs(z) < 0.5);
      assert.equal(center.length, 144);
      assert.ok(center.every(({ exposedSides, boundaryExtension }) =>
        exposedSides === (15 & ~(1 << closedSide)) && boundaryExtension[closedSide] === 0));
    }
  });

  it("limits paving overhang to four centimeters without shrinking the lawn", () => {
    const input = map([[TileType.GRASS, TileType.PATH, TileType.GRASS]]);
    input.heightmap[0] = [2, 2, 3];
    const left = GrassCarpetLayout.create(input).filter(({ x }) => x < -0.5);
    assert.ok(left.every(({ exposedSides }) => (exposedSides & 4) === 0));
    assert.ok(left.every(({ boundaryExtension }) => boundaryExtension[2] <= 0.04));
    const right = GrassCarpetLayout.create(input).filter(({ x }) => x > 0.5);
    assert.ok(right.every(({ exposedSides }) => (exposedSides & 1) === 1));
  });
});
