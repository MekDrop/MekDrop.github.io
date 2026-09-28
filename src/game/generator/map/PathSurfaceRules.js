import { TILE_SHAPE } from "../../enum/TileShape.js";
import { MAP_DIRECTION as DIRECTIONS } from "../../enum/MapDirection.js";
import { MAP_TILE_TYPE as TileType } from "../../enum/MapTileType.js";
import { MapGrid } from "./MapGrid.js";

/**
 * @typedef {import("./MapGenerationTypes.js").TileMetadata} TileMetadata
 * @typedef {import("./MapGenerationTypes.js").GridCell} GridCell
 */

/**
 * Two-lane support and bridge classification shared by terrain construction and validation.
 */
export class PathSurfaceRules {
  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {number} col
   * @param {number} row
   */
  static classifyRenderMode(grid, heightmap, tileMeta, col, row) {
    const tile = grid[row][col];
    if (tile !== TileType.PATH) {
      return "SOLID";
    }
    if (tileMeta[row][col].shape === TILE_SHAPE.SLOPE) {
      return "SOLID";
    }
    if (tileMeta[row][col].overpassId && !tileMeta[row][col].overpass) {
      return "SOLID";
    }

    const lateralCells = PathSurfaceRules.pathLateralCells(grid, tileMeta, col, row);
    if (!lateralCells) {
      return "SOLID";
    }
    if (PathSurfaceRules.isPathTurnPosition(grid, lateralCells)) {
      return "SOLID";
    }

    const pathHeight = heightmap[row][col];
    const hasLateralSupport = lateralCells.some(
      /**
       *
       * @param {{col: number, row: number}} options
       * @param {number} options.col
       * @param {number} options.row
       */
      ({ col: sideCol, row: sideRow }) =>
        PathSurfaceRules.hasPathSideBlock(grid, heightmap, sideCol, sideRow, pathHeight),
    );
    return hasLateralSupport ? "SOLID" : "BRIDGE";
  }

  /**
   * @param {number[][]} grid
   * @param {GridCell[]} lateralCells
   */
  static isPathTurnPosition(grid, lateralCells) {
    return lateralCells.some(
      /**
       *
       * @param {{col: number, row: number}} options
       * @param {number} options.col
       * @param {number} options.row
       */
      ({ col, row }) =>
        MapGrid.inBounds(col, row) && MapGrid.isRouteTile(grid[row][col]),
    );
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {number} col
   * @param {number} row
   * @param {number} pathHeight
   */
  static hasPathSideBlock(grid, heightmap, col, row, pathHeight) {
    if (!MapGrid.inBounds(col, row) || grid[row][col] === TileType.WATER) {
      return false;
    }
    return heightmap[row][col] >= pathHeight;
  }

  /**
   * @param {number[][]} grid
   * @param {TileMetadata[][]} tileMeta
   * @param {number} col
   * @param {number} row
   */
  static pathLateralCells(grid, tileMeta, col, row) {
    const direction = tileMeta[row][col].direction;
    if (
      direction === DIRECTIONS.EAST ||
      direction === DIRECTIONS.WEST
    ) {
      const mateRow = PathSurfaceRules.findLaneMateRow(
        grid,
        tileMeta,
        col,
        row,
        direction,
      );
      if (mateRow === null) {
        return null;
      }
      return [
        { col, row: Math.min(row, mateRow) - 1 },
        { col, row: Math.max(row, mateRow) + 1 },
      ];
    }

    if (
      direction === DIRECTIONS.NORTH ||
      direction === DIRECTIONS.SOUTH
    ) {
      const mateCol = PathSurfaceRules.findLaneMateCol(
        grid,
        tileMeta,
        col,
        row,
        direction,
      );
      if (mateCol === null) {
        return null;
      }
      return [
        { col: Math.min(col, mateCol) - 1, row },
        { col: Math.max(col, mateCol) + 1, row },
      ];
    }

    return null;
  }

  /**
   * @param {number[][]} grid
   * @param {TileMetadata[][]} tileMeta
   * @param {number} col
   * @param {number} row
   * @param {string} direction
   */
  static findLaneMateRow(grid, tileMeta, col, row, direction) {
    const candidates = [row - 1, row + 1];
    for (const candidateRow of candidates) {
      if (!MapGrid.inBounds(col, candidateRow)) { continue; }
      const candidateTile = grid[candidateRow][col];
      if (candidateTile !== TileType.PATH && candidateTile !== TileType.ENTRY)
        { continue; }
      if (tileMeta[candidateRow][col].direction === direction) {
        return candidateRow;
      }
    }
    return null;
  }

  /**
   * @param {number[][]} grid
   * @param {TileMetadata[][]} tileMeta
   * @param {number} col
   * @param {number} row
   * @param {string} direction
   */
  static findLaneMateCol(grid, tileMeta, col, row, direction) {
    const candidates = [col - 1, col + 1];
    for (const candidateCol of candidates) {
      if (!MapGrid.inBounds(candidateCol, row)) { continue; }
      const candidateTile = grid[row][candidateCol];
      if (candidateTile !== TileType.PATH && candidateTile !== TileType.ENTRY)
        { continue; }
      if (tileMeta[row][candidateCol].direction === direction) {
        return candidateCol;
      }
    }
    return null;
  }
}
