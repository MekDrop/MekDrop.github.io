import {
  BridgeGroundHeightMismatchError,
  BridgeTurnError,
  InvalidOverpassError,
  InvalidPathDipError,
  PathHeightMismatchError,
  PathRenderModeMismatchError,
} from "../../errors/map/index.js";
import { TILE_SHAPE } from "../../enum/TileShape.js";
import {
  MAP_COLS,
  MAP_ROWS,
  PATH_HEIGHT,
  OVERPASS_ELEVATION,
  OVERPASS_RAMP_TILES,
  OVERPASS_HALF_STEP,
  TERRAIN_BRIDGE_DIP_ELEVATION,
  TERRAIN_BRIDGE_DIP_RAMP_TILES,
} from "./mapGenerationConfig.js";
import { MAP_DIRECTION as DIRECTIONS } from "../../enum/MapDirection.js";
import { MAP_TILE_TYPE as TileType } from "../../enum/MapTileType.js";
import { MapGrid } from "./MapGrid.js";
import { PathSurfaceRules } from "./PathSurfaceRules.js";

/**
 * @typedef {import("./MapGenerationTypes.js").TileMetadata} TileMetadata
 * @typedef {import("./MapGenerationTypes.js").MapCell} MapCell
 * @typedef {import("./MapGenerationTypes.js").OverpassPlan} OverpassPlan
 * @typedef {import("./MapGenerationTypes.js").RiverRecord} RiverRecord
 * @typedef {import("./MapGenerationTypes.js").GridCell} GridCell
 * @typedef {import("./MapGenerationTypes.js").RiverData} RiverData
 * @typedef {import("./MapGenerationTypes.js").PathDipPlan} PathDipPlan
 */

/**
 * Validates path elevation profiles, overpasses, terrain dips, and bridge surfaces.
 */
export class PathSurfaceValidator {
  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   */
  validateHeightDiscipline(grid, heightmap, tileMeta) {
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const tile = grid[row][col];
        if (tile !== TileType.PATH && tile !== TileType.ENTRY) {
          continue;
        }
        const metadata = tileMeta[row][col];
        const validOverpassHeight =
          metadata.overpassId &&
          (metadata.shape === TILE_SHAPE.SLOPE
            ? Number.isFinite(metadata.slope?.lowHeight) &&
              Number.isFinite(metadata.slope?.highHeight) &&
              heightmap[row][col] ===
                (metadata.slope.lowHeight + metadata.slope.highHeight) / 2
            : heightmap[row][col] === OVERPASS_ELEVATION ||
              heightmap[row][col] === PATH_HEIGHT);
        const validPathDipHeight =
          metadata.pathDipId &&
          (metadata.shape === TILE_SHAPE.SLOPE
            ? Number.isFinite(metadata.slope?.lowHeight) &&
              Number.isFinite(metadata.slope?.highHeight) &&
              metadata.slope.highHeight - metadata.slope.lowHeight ===
                1 / TERRAIN_BRIDGE_DIP_RAMP_TILES &&
              heightmap[row][col] ===
                (metadata.slope.lowHeight + metadata.slope.highHeight) / 2
            : metadata.shape === TILE_SHAPE.FLAT &&
              heightmap[row][col] === TERRAIN_BRIDGE_DIP_ELEVATION);
        if (
          heightmap[row][col] !== PATH_HEIGHT &&
          !validOverpassHeight &&
          !validPathDipHeight
        ) {
          throw new PathHeightMismatchError();
        }
      }
    }
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {OverpassPlan} plan
   */
  validateOverpass(grid, heightmap, tileMeta, plan) {
    if (!plan) {
      return;
    }

    /**
     *
     * @param {GridCell[]} cells
     * @param {number} expectedHeight
     * @param {string} expectedShape
     */
    const validatePathCells = (cells, expectedHeight, expectedShape) => {
      for (const cell of cells) {
        if (
          !MapGrid.inBounds(cell.col, cell.row) ||
          grid[cell.row][cell.col] !== TileType.PATH ||
          tileMeta[cell.row][cell.col].overpassId !== plan.id ||
          tileMeta[cell.row][cell.col].shape !== expectedShape ||
          heightmap[cell.row][cell.col] !== expectedHeight
        ) {
          throw new InvalidOverpassError({
            reason: `has invalid path terrain at (${cell.col}, ${cell.row})`,
          });
        }
      }
    };

    validatePathCells(plan.crossingCells, plan.baseElevation, TILE_SHAPE.FLAT);
    validatePathCells(plan.approachCells, plan.deckElevation, TILE_SHAPE.FLAT);
    for (const cell of plan.approachCells) {
      if (
        tileMeta[cell.row][cell.col].renderMode !== "SOLID" ||
        tileMeta[cell.row][cell.col].bridgeGroundHeight !== null
      ) {
        throw new InvalidOverpassError({
          reason: `does not fill its elevated approach at (${cell.col}, ${cell.row})`,
        });
      }
    }
    for (const cell of plan.raisedApproachCells ?? []) {
      const tile = grid[cell.row]?.[cell.col];
      if (
        !MapGrid.inBounds(cell.col, cell.row) ||
        (tile !== TileType.PATH && tile !== TileType.ENTRY) ||
        tileMeta[cell.row][cell.col].overpassId !== plan.id ||
        tileMeta[cell.row][cell.col].shape !== TILE_SHAPE.FLAT ||
        heightmap[cell.row][cell.col] !== plan.deckElevation
      ) {
        throw new InvalidOverpassError({
          reason: `has invalid raised entry path at (${cell.col}, ${cell.row})`,
        });
      }
    }
    for (const cell of plan.raisedTerrainCells ?? []) {
      if (
        grid[cell.row][cell.col] !== TileType.GRASS ||
        heightmap[cell.row][cell.col] !== plan.deckElevation ||
        tileMeta[cell.row][cell.col].overpassPlateauId !== plan.id
      ) {
        throw new InvalidOverpassError({
          reason: `has invalid raised entry terrain at (${cell.col}, ${cell.row})`,
        });
      }
    }
    const expectedSlopeCellCount =
      OVERPASS_RAMP_TILES * (plan.raisedEntryApproach ? 2 : 4);
    if (plan.slopeCells.length !== expectedSlopeCellCount) {
      throw new InvalidOverpassError({
        reason: "does not preserve its required two-tile-wide approach flights",
      });
    }
    for (const cell of plan.slopeCells) {
      validatePathCells(
        [cell],
        (cell.lowHeight + cell.highHeight) / 2,
        TILE_SHAPE.SLOPE,
      );
      const slope = tileMeta[cell.row][cell.col].slope;
      if (
        slope.lowHeight !== cell.lowHeight ||
        slope.highHeight !== cell.highHeight ||
        slope.riseDirection !== cell.riseDirection ||
        slope.highHeight - slope.lowHeight !== OVERPASS_HALF_STEP
      ) {
        throw new InvalidOverpassError({
          reason: `has an invalid gentle ramp at (${cell.col}, ${cell.row})`,
        });
      }
    }

    const landingRows = [
      plan.crossing.row - OVERPASS_RAMP_TILES - 2,
      plan.crossing.row + OVERPASS_RAMP_TILES + 3,
    ];
    for (const row of landingRows) {
      for (
        let col = plan.crossing.col;
        col < plan.crossing.col + plan.crossing.width;
        col += 1
      ) {
        if (!MapGrid.inBounds(col, row) || grid[row][col] !== TileType.PATH) {
          throw new InvalidOverpassError({
            reason: `narrows below two path tiles at (${col}, ${row})`,
          });
        }
      }
    }

    for (const cell of plan.crossingCells) {
      const overpass = tileMeta[cell.row][cell.col].overpass;
      if (
        overpass?.elevation !== plan.deckElevation ||
        overpass.direction !== plan.upperDirection ||
        tileMeta[cell.row][cell.col].direction !== plan.lowerDirection
      ) {
        throw new InvalidOverpassError({
          reason: `does not preserve two separate routes at (${cell.col}, ${cell.row})`,
        });
      }
    }
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {PathDipPlan[]} plans
   * @param {RiverData[]} riverData
   */
  validatePathDips(grid, heightmap, tileMeta, plans, riverData) {
    const riverCells = new Set(
      riverData.flatMap(/**
       *
       * @param {RiverRecord} river
       */
      (river) =>
        river.cells.map(/**
         *
         * @param {MapCell} cell
         */
        (cell) => MapGrid.tileKey(cell.col, cell.row)),
      ),
    );
    const planIds = new Set();
    const plannedCells = new Set();

    for (const plan of plans) {
      if (planIds.has(plan.id)) {
        throw new InvalidPathDipError({
          id: plan.id,
          reason: "has a duplicate identifier",
        });
      }
      planIds.add(plan.id);
      if (
        plan.rampTiles !== TERRAIN_BRIDGE_DIP_RAMP_TILES ||
        plan.slopeCells.length !== plan.rampTiles * 4 ||
        plan.flatCells.length < 2 ||
        plan.landingCells.length !== 4
      ) {
        throw new InvalidPathDipError({
          id: plan.id,
          reason: "does not preserve a two-tile-wide descent and landing",
        });
      }

      for (const cell of [...plan.slopeCells, ...plan.flatCells]) {
        const key = MapGrid.tileKey(cell.col, cell.row);
        const metadata = tileMeta[cell.row]?.[cell.col];
        if (
          plannedCells.has(key) ||
          !metadata ||
          grid[cell.row][cell.col] !== TileType.PATH ||
          metadata.pathDipId !== plan.id ||
          metadata.overpassId ||
          riverCells.has(key) ||
          metadata.renderMode !== "SOLID" ||
          metadata.bridgeGroundHeight !== null
        ) {
          throw new InvalidPathDipError({
            id: plan.id,
            reason: `has invalid terrain at (${cell.col}, ${cell.row})`,
          });
        }
        plannedCells.add(key);
      }

      for (const cell of plan.flatCells) {
        if (
          tileMeta[cell.row][cell.col].shape !== TILE_SHAPE.FLAT ||
          heightmap[cell.row][cell.col] !== plan.elevation
        ) {
          throw new InvalidPathDipError({
            id: plan.id,
            reason: `has an invalid low section at (${cell.col}, ${cell.row})`,
          });
        }
      }

      for (const cell of plan.slopeCells) {
        const metadata = tileMeta[cell.row][cell.col];
        const slope = metadata.slope;
        if (
          metadata.shape !== TILE_SHAPE.SLOPE ||
          heightmap[cell.row][cell.col] !==
            (cell.lowHeight + cell.highHeight) / 2 ||
          slope?.lowHeight !== cell.lowHeight ||
          slope.highHeight !== cell.highHeight ||
          slope.riseDirection !== cell.riseDirection ||
          slope.highHeight - slope.lowHeight !== 1 / plan.rampTiles
        ) {
          throw new InvalidPathDipError({
            id: plan.id,
            reason: `has an invalid ramp at (${cell.col}, ${cell.row})`,
          });
        }
      }

      for (const cell of plan.landingCells) {
        const metadata = tileMeta[cell.row]?.[cell.col];
        if (
          !metadata ||
          grid[cell.row][cell.col] !== TileType.PATH ||
          heightmap[cell.row][cell.col] !== PATH_HEIGHT ||
          metadata.shape !== TILE_SHAPE.FLAT ||
          metadata.direction !== plan.direction ||
          metadata.overpassId ||
          riverCells.has(MapGrid.tileKey(cell.col, cell.row)) ||
          metadata.renderMode !== "SOLID"
        ) {
          throw new InvalidPathDipError({
            id: plan.id,
            reason: `has an invalid landing at (${cell.col}, ${cell.row})`,
          });
        }
      }
    }

    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const pathDipId = tileMeta[row][col].pathDipId;
        if (
          pathDipId &&
          (!planIds.has(pathDipId) ||
            !plannedCells.has(MapGrid.tileKey(col, row)))
        ) {
          throw new InvalidPathDipError({
            id: pathDipId,
            reason: `has undeclared terrain at (${col}, ${row})`,
          });
        }
      }
    }
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   */
  validatePathRenderModes(grid, heightmap, tileMeta) {
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (grid[row][col] !== TileType.PATH) {
          continue;
        }
        const expected = PathSurfaceRules.classifyRenderMode(
          grid,
          heightmap,
          tileMeta,
          col,
          row,
        );
        const actual = tileMeta[row][col].renderMode;
        if (actual !== expected) {
          throw new PathRenderModeMismatchError({
            col,
            row,
            expected,
            actual,
          });
        }
      }
    }
  }

  /**
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {RiverData[]} riverData
   */
  validateBridgeGroundHeights(heightmap, tileMeta, riverData) {
    const riverBridgeCells = new Set(
      riverData.flatMap(/**
       *
       * @param {RiverRecord} river
       */
      (river) =>
        river.cells
          .filter(/**
           *
           * @param {MapCell} cell
           */
          (cell) => cell.underBridge)
          .map(/**
           *
           * @param {MapCell} cell
           */
          (cell) => MapGrid.tileKey(cell.col, cell.row)),
      ),
    );
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (
          tileMeta[row][col].renderMode !== "BRIDGE" ||
          riverBridgeCells.has(MapGrid.tileKey(col, row))
        ) {
          continue;
        }
        const expectedHeight = tileMeta[row][col].islandConnector
          ? null
          : Math.max(1, heightmap[row][col] - 1);
        const actualHeight = tileMeta[row][col].bridgeGroundHeight;
        if (actualHeight !== expectedHeight) {
          throw new BridgeGroundHeightMismatchError({
            col,
            row,
            expectedHeight,
            actualHeight,
          });
        }
      }
    }
  }

  /**
   * @param {TileMetadata[][]} tileMeta
   */
  validateBridgeTurns(tileMeta) {
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (tileMeta[row][col].renderMode !== "BRIDGE") {
          continue;
        }
        const direction = tileMeta[row][col].direction;
        const horizontal =
          direction === DIRECTIONS.EAST ||
          direction === DIRECTIONS.WEST;
        for (const [deltaCol, deltaRow] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const neighborCol = col + deltaCol;
          const neighborRow = row + deltaRow;
          if (
            !MapGrid.inBounds(neighborCol, neighborRow) ||
            tileMeta[neighborRow][neighborCol].renderMode !== "BRIDGE"
          ) {
            continue;
          }
          const neighborDirection =
            tileMeta[neighborRow][neighborCol].direction;
          const neighborHorizontal =
            neighborDirection === DIRECTIONS.EAST ||
            neighborDirection === DIRECTIONS.WEST;
          if (horizontal !== neighborHorizontal) {
            throw new BridgeTurnError({ col, row });
          }
        }
      }
    }
  }
}
