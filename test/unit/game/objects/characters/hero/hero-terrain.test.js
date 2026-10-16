import assert from "node:assert/strict";
import { it } from "node:test";
import { HeroTerrain } from "../../../../../../src/game/objects/characters/hero/HeroTerrain.js";
import { MAP_TILE_TYPE as TileType } from "../../../../../../src/game/enum/MapTileType.js";
import { TILE_SHAPE } from "../../../../../../src/game/enum/TileShape.js";
import { SLOPE_DIRECTION } from "../../../../../../src/game/enum/SlopeDirection.js";
import { GRASS_SURFACE_LIFT } from "../../../../../../src/game/config/terrain.js";

function map() {
  return {
    cols: 3,
    rows: 3,
    grid: Array.from({ length: 3 }, () => Array(3).fill(TileType.GRASS)),
    heightmap: Array.from({ length: 3 }, () => Array(3).fill(2)),
    tileMeta: Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => ({}))),
  };
}

const standing = {
  position: {
    x: 0,
    y: 2 + GRASS_SURFACE_LIFT,
    z: 0,
  },
  dodging: false,
  fallingToDeath: false,
};

it("blocks approach to raised terrain but permits sliding and retreat from overlap", () => {
  const data = map();
  data.heightmap[1][2] = 4;
  const terrain = new HeroTerrain(data, null, []);
  assert.equal(terrain.occupancyAt(0, 0, 0.2, 0, true, 0.4, standing), "blocked");
  assert.equal(terrain.occupancyAt(0.2, 0, 0.2, 0.1, true, 0.4, standing), "open");
  assert.equal(terrain.occupancyAt(0.2, 0, 0.1, 0, true, 0.4, standing), "open");
  assert.equal(terrain.occupancyAt(0.2, 0, 0.3, 0, true, 0.4, standing), "blocked");
});

it("lets castle support replace foundation height without masking adjacent grass cliffs", () => {
  const data = map();
  data.heightmap[1][2] = 4;
  const terrain = new HeroTerrain(data, { surfaceHeightAt: () => 2 }, []);
  assert.equal(terrain.occupancyAt(0, 0, 0.2, 0, true, 0.4, standing), "blocked");
  data.grid[1][2] = TileType.CASTLE_WALL;
  assert.equal(terrain.occupancyAt(0, 0, 0.2, 0, true, 0.4, standing), "open");
});

it("distinguishes water and map edges from solid terrain during airborne actions", () => {
  const data = map();
  data.grid[1][2] = TileType.WATER;
  const terrain = new HeroTerrain(data, null, []);
  assert.equal(terrain.occupancyAt(0, 0, 0.3, 0, true, 0.4, standing), "edge");
  assert.equal(terrain.occupancyAt(0, 0, 0.3, 0, false, 0.4, standing), "open");
  assert.equal(terrain.occupancyAt(0, 0, 0.3, 0, true, 0.4, {
    ...standing,
    dodging: true,
  }), "open");
  assert.equal(terrain.occupancyAt(0, -1, 0, -1.3, true, 0.4, standing), "edge");
  assert.equal(terrain.occupancyAt(0, -1, 0, -1.3, true, 0.4, {
    ...standing,
    fallingToDeath: true,
  }), "open");
  assert.equal(terrain.isBeyondMapEdge(1.5, 0), false);
  assert.equal(terrain.isBeyondMapEdge(1.5001, 0), true);
});

it("samples all ramp directions and clamps samples to the tile", () => {
  const data = map();
  const terrain = new HeroTerrain(data, null, []);
  for (const [riseDirection, highX, highZ] of [
    [SLOPE_DIRECTION.NORTH, 0, -0.5],
    [SLOPE_DIRECTION.SOUTH, 0, 0.5],
    [SLOPE_DIRECTION.WEST, -0.5, 0],
    [SLOPE_DIRECTION.EAST, 0.5, 0],
  ]) {
    data.tileMeta[1][1] = {
      shape: TILE_SHAPE.SLOPE,
      slope: {
        riseDirection,
        lowHeight: 2,
        highHeight: 3,
      },
    };
    assert.equal(terrain.terrainSurfaceHeightAt(1, 1, 0, 0), 2.5);
    assert.equal(terrain.terrainSurfaceHeightAt(1, 1, highX, highZ), 3);
    assert.equal(terrain.terrainSurfaceHeightAt(1, 1, -highX, -highZ), 2);
    assert.equal(terrain.terrainSurfaceHeightAt(1, 1, highX * 3, highZ * 3), 3);
  }
});

it("selects support below the height cap, including stairs on approach cells and overpasses", () => {
  const data = map();
  data.tileMeta[1][1] = { overpass: { elevation: 4 } };
  const terrain = new HeroTerrain(data, { surfaceHeightAt: () => 2.8 }, []);
  assert.equal(terrain.supportHeightAtPoint(0, 0, 2), null);
  assert.equal(terrain.supportHeightAtPoint(0, 0, 2.5), 2 + GRASS_SURFACE_LIFT);
  assert.equal(terrain.supportHeightAtPoint(0, 0, 3), 2.8);
  assert.equal(terrain.supportHeightAtPoint(0, 0, 4), 4);
  assert.equal(terrain.supportHeightAtPoint(2, 0, 10), null);
});

it("keeps point support distinct from the wider dodge runway footprint", () => {
  const data = map();
  data.grid[1][2] = TileType.WATER;
  const terrain = new HeroTerrain(data, null, []);
  assert.equal(terrain.supportHeightAtPoint(0.6, 0, 3), null);
  assert.equal(terrain.surfaceAt(0.6, 0, 3), 2 + GRASS_SURFACE_LIFT);
  assert.equal(terrain.surfaceAt(0.8, 0, 3), null);
});

it("honors river source covers, their cell bounds and their support height", () => {
  const data = map();
  data.grid[1][1] = TileType.WATER;
  const cover = {
    col: 1,
    row: 1,
    centerX: 0,
    centerZ: 0,
    flowX: 0,
    flowZ: -1,
    height: 2.2,
  };
  const terrain = new HeroTerrain(data, null, [cover]);
  assert.equal(terrain.supportHeightAtPoint(0, 0, 2.3), 2.2);
  assert.equal(terrain.supportHeightAtPoint(0, 0, 2), null);
  assert.equal(terrain.riverSourceCoverHeightAt(0.5, -0.5), 2.2);
  assert.equal(terrain.riverSourceCoverHeightAt(0.501, 0), null);
  assert.equal(terrain.riverSourceCoverHeightAt(0, 0, 2, 1), null);
  assert.equal(terrain.occupancyAt(-1, 0, -0.7, 0, true, 0.4, standing), "open");
});

it("walks through excavated path cells while retaining soil outside the cut", () => {
  const data = map();
  for (const row of data.heightmap) {
    row.fill(0);
  }
  data.grid[1][2] = TileType.PATH;
  data.heightmap[1][2] = 2;
  const cut = {
    minX: 0.5,
    maxX: 1.1,
    minZ: -0.5,
    maxZ: 0.5,
    minY: -0.25,
    maxY: 2.75,
  };
  data.tileMeta[1][2].terrainCutouts = [cut];
  const terrain = new HeroTerrain(data, { surfaceHeightAt: () => 0 }, []);
  const basement = {
    ...standing,
    position: {
      x: 0,
      y: 0.004,
      z: 0,
    },
  };
  assert.equal(terrain.occupancyAt(0, 0, 0.3, 0, true, 0.4, basement), "open");
  assert.equal(terrain.occupancyAt(0.3, 0, 0.75, 0, true, 0.4, basement), "blocked");
  assert.equal(terrain.occupancyAt(0.75, 0, 0.65, 0, true, 0.4, basement), "open");
  cut.minY = 1;
  assert.equal(terrain.occupancyAt(0, 0, 0.3, 0, true, 0.4, basement), "blocked");
});

it("clears the reported basement approach under the two outdoor entrance lanes", () => {
  const data = {
    cols: 42,
    rows: 42,
    grid: Array.from({ length: 42 }, () => Array(42).fill(TileType.CASTLE_WALL)),
    heightmap: Array.from({ length: 42 }, () => Array(42).fill(3)),
    tileMeta: Array.from({ length: 42 }, () => Array.from({ length: 42 }, () => ({}))),
  };
  for (const row of [6, 7]) {
    data.grid[row][30] = TileType.PATH;
    data.heightmap[row][30] = 2;
    data.tileMeta[row][30].terrainCutouts = [{
      minX: 9,
      maxX: 16.5,
      minZ: -15.5,
      maxZ: -8,
      minY: -0.25,
      maxY: Number.MAX_VALUE,
    }];
  }
  const terrain = new HeroTerrain(data, { surfaceHeightAt: () => 0 }, []);
  const basement = {
    ...standing,
    position: {
      x: 9.875,
      y: 0.004,
      z: -15.125,
    },
  };
  for (let z = -15.125; z <= -13.125; z += 0.05) {
    assert.equal(terrain.occupancyAt(9.875, z, 9.875, z + 0.05, true, 0.4, basement), "open");
    assert.equal(terrain.occupancyAt(9.875, z + 0.05, 9.875, z, true, 0.4, basement), "open");
  }
  data.tileMeta[6][30].terrainCutouts = [];
  assert.equal(terrain.occupancyAt(9.875, -15.125, 9.875, -15.075, true, 0.4, basement), "blocked");
});
