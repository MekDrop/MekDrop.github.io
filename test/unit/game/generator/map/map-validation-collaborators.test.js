import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import {
  DisconnectedTerrainError,
  InvalidGroundCoverPlacementError,
  InvalidLavaRiverCountError,
  InvalidOverpassError,
  InvalidPathDipError,
  InvalidRiverCountError,
  InvalidRiverPathError,
  IsolatedTerrainHoleError,
  NoPlayableTerrainError,
  PathOutsideGateError,
  UnexpectedPathConnectionError,
} from "../../../../../src/game/errors/map/index.js";
import { MapGenerator, TileType } from "../../../../../src/game/generator/map/MapGenerator.js";
import { MapGrid } from "../../../../../src/game/generator/map/MapGrid.js";
import { TerrainValidator } from "../../../../../src/game/generator/map/TerrainValidator.js";
import { RouteValidator } from "../../../../../src/game/generator/map/RouteValidator.js";
import { PathSurfaceValidator } from "../../../../../src/game/generator/map/PathSurfaceValidator.js";
import { DecorationValidator } from "../../../../../src/game/generator/map/DecorationValidator.js";
import { RiverValidator } from "../../../../../src/game/generator/map/RiverValidator.js";
import { RIVER_KIND } from "../../../../../src/game/enum/RiverKind.js";

describe("map validation collaborators", () => {
  it("rejects empty, disconnected, and enclosed-hole terrain", () => {
    const terrain = new TerrainValidator();
    const grid = MapGrid.createGrid(TileType.WATER);
    assert.throws(() => terrain.validateIslandConnectivity(grid), NoPlayableTerrainError);
    grid[4][4] = TileType.GRASS;
    grid[4][6] = TileType.GRASS;
    assert.throws(() => terrain.validateIslandConnectivity(grid), DisconnectedTerrainError);
    grid[3][5] = grid[5][5] = TileType.GRASS;
    assert.throws(() => terrain.validateNoSingleCellTerrainHoles(grid), IsolatedTerrainHoleError);
    grid[4][5] = TileType.GRASS;
    assert.doesNotThrow(() => terrain.validateIslandConnectivity(grid));
    assert.doesNotThrow(() => terrain.validateNoSingleCellTerrainHoles(grid));
  });

  it("keeps gates on the first playable boundary tiles", () => {
    const validator = new RouteValidator();
    const grid = MapGrid.createGrid(TileType.WATER);
    const layout = {
      entries: [{ gateCol: 4, gateRows: [5, 6], inwardDirection: "EAST" }],
    };
    for (const row of [5, 6]) {
      grid[row][4] = TileType.ENTRY;
      grid[row][5] = TileType.PATH;
    }
    assert.doesNotThrow(() => validator.validateGatePlacement(grid, layout));
    grid[5][3] = TileType.GRASS;
    assert.throws(() => validator.validateGatePlacement(grid, layout), PathOutsideGateError);
  });

  it("rejects branch contacts except the designated overpass", () => {
    const validator = new RouteValidator();
    const branches = [
      { routeCells: new Set(["10,10"]) },
      { routeCells: new Set(["10,11"]) },
    ];
    const layout = { entries: [{ mergeCol: 20 }], pathRows: [20, 21] };
    assert.throws(() => validator.validateRouteSeparation(branches, layout), UnexpectedPathConnectionError);
    layout.overpassPlan = { crossing: { col: 10, row: 10, width: 2, depth: 2 } };
    assert.doesNotThrow(() => validator.validateRouteSeparation(branches, layout));
  });

  it("rejects ground cover on reserved path cells and occupied grass", () => {
    const validator = new DecorationValidator();
    const grid = MapGrid.createGrid(TileType.GRASS);
    const heights = MapGrid.createGrid(1);
    const metadata = MapGrid.createTileMetadata();
    const flowers = [{ col: 10, row: 10, variant: "daisy-patch" }];
    assert.doesNotThrow(() => validator.validateGroundCover(grid, heights, metadata, [], [], flowers));
    assert.throws(
      () => validator.validateGroundCover(grid, heights, metadata, [{ col: 10, row: 10 }], [], flowers),
      InvalidGroundCoverPlacementError,
    );
    grid[10][10] = TileType.PATH;
    assert.throws(
      () => validator.validateGroundCover(grid, heights, metadata, [], [], flowers),
      InvalidGroundCoverPlacementError,
    );
  });

  it("rejects excess rivers, invalid lava counts, and short upstream flow", () => {
    const validator = new RiverValidator();
    assert.throws(
      () => validator.validateRivers([], [], [], [], {}, Array(7).fill({ kind: RIVER_KIND.WATER })),
      InvalidRiverCountError,
    );
    assert.throws(
      () => validator.validateRivers([], [], [], [], {}, Array(3).fill({ kind: RIVER_KIND.LAVA })),
      InvalidLavaRiverCountError,
    );
    assert.throws(
      () => validator.validateRivers([], [], [], [], {}, [{ id: "short", kind: RIVER_KIND.WATER, cells: [], upstreamLength: 4 }]),
      InvalidRiverPathError,
    );
  });

  describe("generated elevation profiles", () => {
    let original;
    before(async () => {
      original = await MapGenerator.generate({ mapName: "variant-4", numPaths: 4, numRivers: 0, overpass: true });
    });

    it("rejects a damaged overpass ramp", () => {
      const map = structuredClone(original);
      const validator = new PathSurfaceValidator();
      assert.doesNotThrow(() => validator.validateOverpass(map.grid, map.heightmap, map.tileMeta, map.overpassData));
      const cell = map.overpassData.slopeCells[0];
      map.tileMeta[cell.row][cell.col].slope.highHeight += 0.5;
      assert.throws(() => validator.validateOverpass(map.grid, map.heightmap, map.tileMeta, map.overpassData), InvalidOverpassError);
    });

    it("rejects a terrain dip whose lane became a bridge", () => {
      const map = structuredClone(original);
      const validator = new PathSurfaceValidator();
      assert.ok(map.pathDipData.length > 0);
      assert.doesNotThrow(() => validator.validatePathDips(map.grid, map.heightmap, map.tileMeta, map.pathDipData, map.riverData));
      const cell = map.pathDipData[0].slopeCells[0];
      map.tileMeta[cell.row][cell.col].renderMode = "BRIDGE";
      assert.throws(() => validator.validatePathDips(map.grid, map.heightmap, map.tileMeta, map.pathDipData, map.riverData), InvalidPathDipError);
    });
  });
});
