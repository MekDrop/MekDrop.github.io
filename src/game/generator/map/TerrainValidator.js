import {
  DisconnectedTerrainError,
  InsufficientLayoutVarietyError,
  IsolatedGrassElevationError,
  IsolatedTerrainHoleError,
  NoPlayableTerrainError,
} from "../../errors/map/index.js";
import { MAP_COLS, MAP_ROWS } from "./mapGenerationConfig.js";
import { MAP_TILE_TYPE as TileType } from "../../enum/MapTileType.js";
import { MapGrid } from "./MapGrid.js";

/**
 * @typedef {import("./MapGenerationTypes.js").TileMetadata} TileMetadata
 * @typedef {import("./MapGenerationTypes.js").MapLayout} MapLayout
 * @typedef {import("./MapGenerationTypes.js").RiverData} RiverData
 */

/**
 * Validates connected land, holes, grass heights, and layout variety.
 */
export class TerrainValidator {
  /**
   * @param {number[][]} grid
   */
  validateIslandConnectivity(grid) {
    const allLand = [];
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (grid[row][col] !== TileType.WATER) {
          allLand.push({ col, row });
        }
      }
    }

    if (!allLand.length) {
      throw new NoPlayableTerrainError();
    }

    const seen = MapGrid.findConnectedComponent(grid, [allLand[0]]);
    if (seen.size !== allLand.length) {
      throw new DisconnectedTerrainError();
    }
  }

  /**
   * @param {number[][]} grid
   */
  validateNoSingleCellTerrainHoles(grid) {
    for (let row = 1; row < MAP_ROWS - 1; row++) {
      for (let col = 1; col < MAP_COLS - 1; col++) {
        if (grid[row][col] !== TileType.WATER) {
          continue;
        }
        const enclosed = [
          grid[row - 1][col],
          grid[row + 1][col],
          grid[row][col - 1],
          grid[row][col + 1],
        ].every(/**
         *
         * @param {TileMetadata} tile
         */
        (tile) => tile !== TileType.WATER);
        if (enclosed) {
          throw new IsolatedTerrainHoleError({ col, row });
        }
      }
    }
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {RiverData[]} riverData
   */
  validateGrassNoise(grid, heightmap, tileMeta, riverData) {
    const intentionalRiverBanks = new Set();
    for (const river of riverData) {
      for (const cell of river.cells) {
        for (let deltaRow = -1; deltaRow <= 1; deltaRow++) {
          for (let deltaCol = -1; deltaCol <= 1; deltaCol++) {
            intentionalRiverBanks.add(
              MapGrid.tileKey(cell.col + deltaCol, cell.row + deltaRow),
            );
          }
        }
      }
    }

    for (let row = 1; row < MAP_ROWS - 1; row++) {
      for (let col = 1; col < MAP_COLS - 1; col++) {
        if (grid[row][col] !== TileType.GRASS) { continue; }
        if (heightmap[row][col] <= 1) { continue; }

        let relatedNeighbors = 0;
        for (const [dc, dr] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          if (grid[row + dr][col + dc] !== TileType.GRASS) { continue; }
          if (heightmap[row + dr][col + dc] >= heightmap[row][col] - 1) {
            relatedNeighbors++;
          }
        }

        if (
          relatedNeighbors === 0 &&
          !intentionalRiverBanks.has(MapGrid.tileKey(col, row))
        ) {
          throw new IsolatedGrassElevationError();
        }
      }
    }
  }

  /**
   * @param {MapLayout} layout
   */
  validateLayoutVariety(layout) {
    if (
      layout.islandEllipses.every(/**
       *
       * @param {{centerCol: number, centerRow: number, radiusCol: number, radiusRow: number}} ellipse
       * @param {number} index
       */
      (ellipse, index) => {
        const base = [
          { centerCol: 23, centerRow: 16, radiusX: 18, radiusY: 12 },
          { centerCol: 15, centerRow: 15, radiusX: 12, radiusY: 10 },
          { centerCol: 14, centerRow: 27, radiusX: 10, radiusY: 7 },
          { centerCol: 29, centerRow: 13, radiusX: 10, radiusY: 8 },
        ][index];
        return (
          base &&
          ellipse.centerCol === base.centerCol &&
          ellipse.centerRow === base.centerRow &&
          ellipse.radiusX === base.radiusX &&
          ellipse.radiusY === base.radiusY
        );
      })
    ) {
      throw new InsufficientLayoutVarietyError();
    }
  }
}
