import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GrassCarpetLayout } from "../../../../../src/game/objects/ground-cover/GrassCarpetLayout.js";
import { TileType } from "../../../../../src/game/generator/map/MapGenerator.js";
import { GRASS_SURFACE_LIFT } from "../../../../../src/game/config/terrain.js";
import { TILE_SHAPE } from "../../../../../src/game/enum/TileShape.js";

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
    assert.equal(placements.length, 75);
    assert.equal(placements.filter(({ detail }) => !detail).length, 27);
    assert.ok(placements.every(({ x, z }) => Math.abs(x + 2.5) < 0.5 && Math.abs(z) < 0.5));
    assert.deepEqual(input, before);
  });

  it("is deterministic and keeps the authored 0.34-unit blades below ankle height", () => {
    const input = map([[TileType.GRASS, TileType.GRASS]]);
    input.heightmap[0][1] = 4;
    const placements = GrassCarpetLayout.create(input);
    assert.deepEqual(placements, GrassCarpetLayout.create(input));
    assert.ok(new Set(placements.map(({ rotation }) => rotation)).size > 20);
    assert.ok(placements.filter(({ fringe }) => !fringe).every(({ height, broadleaf }) => height * (broadleaf ? 0.19 : 0.34) < 0.075));
    assert.ok(placements.some(({ broadleaf }) => broadleaf));
    assert.ok(placements.some(({ broadleaf }) => !broadleaf));
    assert.ok(placements.filter(({ x }) => x > 0).every(({ y }) => y === 4 + GRASS_SURFACE_LIFT - 0.002));
  });

  it("does not put floating clumps on slopes, voids or river bridges", () => {
    const input = map([[TileType.GRASS, TileType.GRASS, TileType.PATH]]);
    input.tileMeta[0][0].shape = TILE_SHAPE.SLOPE;
    input.heightmap[0][1] = 0;
    input.tileMeta[0][2].renderMode = "BRIDGE";
    input.tileMeta[0][2].bridgeGroundHeight = null;
    assert.deepEqual(GrassCarpetLayout.create(input), []);
  });

  it("covers grass-topped ground beneath ordinary bridges", () => {
    const input = map([[TileType.PATH, TileType.PATH]]);
    input.tileMeta[0][0] = {
      renderMode: "BRIDGE",
      bridgeGroundHeight: 1,
    };
    input.tileMeta[0][1] = {
      renderMode: "BRIDGE",
      bridgeGroundHeight: 1,
    };

    const placements = GrassCarpetLayout.create(input);
    assert.equal(placements.length, 150);
    assert.ok(
      placements.every(
        ({ y }) => y === 1 + GRASS_SURFACE_LIFT - 0.002,
      ),
    );
    assert.ok(
      placements.every(({ x, exposedSides }) =>
        x < 0 ? exposedSides === 11 : exposedSides === 14,
      ),
    );
  });

  it("keeps full grass scatter beneath vegetation for footprint clipping", () => {
    const input = map([[TileType.GRASS, TileType.GRASS]]);
    input.objects = [
      { object: "Vegetation", tile: { col: 0, row: 0 }, kind: "tree" },
      { object: "Vegetation", tile: { col: 1, row: 0 }, kind: "bush" },
    ];

    const placements = GrassCarpetLayout.create(input);
    const treeGrass = placements.filter(({ x }) => x < 0);
    const bushGrass = placements.filter(({ x }) => x > 0);

    assert.equal(treeGrass.length, 75);
    assert.equal(bushGrass.length, 75);
    assert.ok(
      treeGrass.some(
        ({ x, z }) =>
          Math.abs(x + 0.5) <= 0.125 && Math.abs(z) <= 0.125,
      ),
    );
    assert.ok(
      bushGrass.some(
        ({ x, z }) => Math.abs(x - 0.5) < 0.16 && Math.abs(z) < 0.16,
      ),
    );
  });

  it("covers solid source caps with grass while keeping downstream water clear", () => {
    const input = map([[TileType.WATER, TileType.WATER]]);
    input.heightmap[0] = [0, 0];
    input.riverData = [{ cells: [
      { col: 0, row: 0, terrainHeight: 3 },
      { col: 1, row: 0, terrainHeight: 2 },
    ] }];
    const placements = GrassCarpetLayout.create(input);
    assert.equal(placements.length, 76);
    assert.ok(placements.every(({ x, y }) => x < 0 && y > 3 && y < 3 + GRASS_SURFACE_LIFT));
  });

  it("adds a short fringe along lower river banks", () => {
    const input = map([[TileType.GRASS, TileType.WATER]]);
    input.heightmap[0] = [2, 0];
    const placements = GrassCarpetLayout.create(input);
    assert.equal(placements.length, 76);
    assert.ok(placements.every(({ boundaryExtension }) => boundaryExtension[2] === 0.1));
    assert.equal(placements.filter(({ fringe, x }) => fringe && Math.abs(x + 0.01) < 0.001).length, 1);
  });
  it("scatters freely across the tile and changes the arrangement with the map seed", () => {
    const input = map([[TileType.GRASS]]);
    const placements = GrassCarpetLayout.create({ ...input, mapName: "lawn-a" });
    const otherSeed = GrassCarpetLayout.create({ ...input, mapName: "lawn-b" });
    assert.notDeepEqual(placements, otherSeed);
    assert.equal(new Set(placements.filter(({ fringe }) => !fringe).map(({ x }) => x)).size, 72);
    assert.equal(new Set(placements.filter(({ fringe }) => !fringe).map(({ z }) => z)).size, 72);
    for (const signX of [-1, 1]) {
      for (const signZ of [-1, 1]) {
        assert.ok(placements.filter(({ x, z }) => x * signX > 0 && z * signZ > 0).length > 8);
      }
    }
  });

  it("preserves lawn scatter and adds wind-responsive turf geometry only on exposed edges", () => {
    const input = map(Array.from({ length: 3 }, () => Array(3).fill(TileType.GRASS)));
    const center = (placements) => placements.filter(({ x, z }) => Math.abs(x) < 0.5 && Math.abs(z) < 0.5);
    const inside = center(GrassCarpetLayout.create(input));
    input.heightmap[1][1] = 3;
    const cliff = center(GrassCarpetLayout.create(input));
    assert.equal(cliff.length, inside.length + 4);
    assert.equal(cliff.filter(({ fringe }) => fringe).length, 4);
    assert.deepEqual(cliff.filter(({ fringe }) => !fringe).map(({ x, z, rotation, width, height }) => [x, z, rotation, width, height]),
      inside.map(({ x, z, rotation, width, height }) => [x, z, rotation, width, height]));
    assert.ok(cliff.every(({ exposedSides }) => exposedSides === 15));
  });

  it("keeps fringe off edges blocked by higher neighbors", () => {
    for (const [closedX, closedZ, closedSide] of [[-1, 0, 0], [0, -1, 1], [1, 0, 2], [0, 1, 3]]) {
      const input = map(Array.from({ length: 3 }, () => Array(3).fill(TileType.GRASS)));
      input.heightmap[1][1] = 3;
      input.heightmap[1 + closedZ][1 + closedX] = 4;
      const center = GrassCarpetLayout.create(input)
        .filter(({ x, z }) => Math.abs(x) < 0.5 && Math.abs(z) < 0.5);
      assert.equal(center.length, 75);
      assert.ok(center.every(({ exposedSides, boundaryExtension }) =>
        exposedSides === (15 & ~(1 << closedSide)) && boundaryExtension[closedSide] === 0));
    }
  });

  it("adds fringe on fractional ledges without putting it on level seams", () => {
    const input = map(Array.from({ length: 3 }, () => Array(3).fill(TileType.GRASS)));
    input.heightmap[1][1] = 2.2;
    const center = GrassCarpetLayout.create(input)
      .filter(({ x, z }) => Math.abs(x) < 0.5 && Math.abs(z) < 0.5);
    assert.equal(center.filter(({ fringe }) => fringe).length, 4);
    input.heightmap[1][1] = 2;
    assert.equal(GrassCarpetLayout.create(input)
      .filter(({ x, z, fringe }) => fringe && Math.abs(x) < 0.5 && Math.abs(z) < 0.5).length, 0);
  });
  it("clips only the excavated portion of a turf edge", () => {
    const input = map([[TileType.GRASS]]);
    input.tileMeta[0][0].terrainCutouts = [{
      minX: -0.1, maxX: 0.1, minY: 1, maxY: 3, minZ: -0.6, maxZ: -0.4,
    }];
    const north = GrassCarpetLayout.create(input)
      .filter(({ fringe, z }) => fringe && Math.abs(z + 0.49) < 0.001);
    assert.equal(north.length, 2);
    assert.ok(north.every(({ x, width }) =>
      x + width / 2 <= -0.119 || x - width / 2 >= 0.119));
  });
  it("keeps grass inside paving boundaries without shrinking the lawn or cliff fringe", () => {
    const input = map([[TileType.GRASS, TileType.PATH, TileType.GRASS]]);
    input.heightmap[0] = [2, 2, 3];
    const left = GrassCarpetLayout.create(input).filter(({ x }) => x < -0.5);
    assert.ok(left.every(({ exposedSides }) => (exposedSides & 4) === 0));
    assert.ok(left.length > 0);
    assert.ok(left.every(({ boundaryExtension }) => boundaryExtension[2] === 0));
    const right = GrassCarpetLayout.create(input).filter(({ x }) => x > 0.5);
    assert.ok(right.every(({ exposedSides }) => (exposedSides & 1) === 1));
    for (const paving of [TileType.PATH, TileType.ENTRY]) {
      const surrounded = map([
        [paving, paving, paving],
        [paving, TileType.GRASS, paving],
        [paving, paving, paving],
      ]);
      const lawn = GrassCarpetLayout.create(surrounded);
      assert.ok(lawn.length > 0);
      assert.ok(lawn.every(({ boundaryExtension, exposedSides }) =>
        boundaryExtension.every((extension) => extension === 0) && exposedSides === 0));
    }
  });
});
