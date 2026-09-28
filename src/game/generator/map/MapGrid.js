import { TILE_SHAPE } from "../../enum/TileShape.js";
import { MAP_COLS, MAP_ROWS, WATER_HEIGHT } from "./mapGenerationConfig.js";
import { MAP_DIRECTION as DIRECTIONS } from "../../enum/MapDirection.js";
import { MAP_TILE_TYPE as TileType } from "../../enum/MapTileType.js";

/**
 * @typedef {import("./MapGenerationTypes.js").TileMetadata} TileMetadata
 * @typedef {import("./MapGenerationTypes.js").GridCell} GridCell
 */

/**
 * Grid ownership, coordinates, and connected land queries shared by generation and validation.
 */
export class MapGrid {
  /**
   * @param {number} col
   * @param {number} row
   */
  static tileKey(col, row) {
    return `${col},${row}`;
  }

  /**
   * @param {number} col
   * @param {number} row
   */
  static inBounds(col, row) {
    return col >= 0 && col < MAP_COLS && row >= 0 && row < MAP_ROWS;
  }

  /**
   * @template T
   * @param {T} fillValue
   * @returns {T[][]}
   */
  static createGrid(fillValue) {
    return Array.from({ length: MAP_ROWS }, () =>
      new Array(MAP_COLS).fill(fillValue),
    );
  }

  static createTileMetadata() {
    return Array.from({ length: MAP_ROWS }, /**
     *
     * @param {undefined} _
     * @param {number} row
     */
    (_, row) =>
      Array.from({ length: MAP_COLS }, /**
       *
       * @param {undefined} _
       * @param {number} col
       */
      (_, col) => ({
        x: col,
        y: row,
        baseHeight: WATER_HEIGHT,
        surfaceType: "WATER",
        shape: TILE_SHAPE.FLAT,
        direction: DIRECTIONS.NONE,
        renderMode: "SOLID",
        bridgeGroundHeight: null,
      })),
    );
  }

  /**
   * @param {number[][]} grid
   * @param {TileMetadata[][]} tileMeta
   * @param {number} col
   * @param {number} row
   * @param {number} type
   * @param {Partial<TileMetadata>} overrides
   */
  static setTile(grid, tileMeta, col, row, type, overrides = {}) {
    if (!MapGrid.inBounds(col, row)) {
      return;
    }
    grid[row][col] = type;
    tileMeta[row][col] = {
      ...tileMeta[row][col],
      surfaceType: overrides.surfaceType ?? tileMeta[row][col].surfaceType,
      baseHeight: overrides.baseHeight ?? tileMeta[row][col].baseHeight,
      shape: overrides.shape ?? tileMeta[row][col].shape,
      direction: overrides.direction ?? tileMeta[row][col].direction,
    };
  }

  /**
   * @param {number[][]} grid
   * @param {TileMetadata[][]} tileMeta
   * @param {number} left
   * @param {number} top
   * @param {number} right
   * @param {number} bottom
   * @param {number} type
   * @param {Partial<TileMetadata>} overrides
   */
  static fillRect(
    grid,
    tileMeta,
    left,
    top,
    right,
    bottom,
    type,
    overrides = {},
  ) {
    for (let row = top; row <= bottom; row++) {
      for (let col = left; col <= right; col++) {
        MapGrid.setTile(grid, tileMeta, col, row, type, overrides);
      }
    }
  }

  /**
   * @param {number[][]} grid
   * @param {GridCell[]} startTiles
   */
  static findConnectedComponent(grid, startTiles) {
    const seen = new Set();
    const queue = [...startTiles];

    while (queue.length) {
      const { col, row } = queue.shift();
      const key = MapGrid.tileKey(col, row);
      if (seen.has(key)) { continue; }
      if (!MapGrid.inBounds(col, row)) { continue; }
      if (grid[row][col] === TileType.WATER) { continue; }

      seen.add(key);
      for (const [dc, dr] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        queue.push({ col: col + dc, row: row + dr });
      }
    }

    return seen;
  }

  /**
   * @param {number} tile
   */
  static isRouteTile(tile) {
    return tile === TileType.PATH || tile === TileType.ENTRY;
  }

  /**
   * @param {GridCell} from
   * @param {GridCell} to
   */
  static directionFromStep(from, to) {
    const deltaCol = to.col - from.col;
    const deltaRow = to.row - from.row;
    if (deltaCol === 1 && deltaRow === 0) {
      return DIRECTIONS.EAST;
    }
    if (deltaCol === -1 && deltaRow === 0) {
      return DIRECTIONS.WEST;
    }
    if (deltaCol === 0 && deltaRow === 1) {
      return DIRECTIONS.SOUTH;
    }
    if (deltaCol === 0 && deltaRow === -1) {
      return DIRECTIONS.NORTH;
    }
    return DIRECTIONS.NONE;
  }

  /**
   * @param {number} value
   * @param {number} min
   * @param {number} max
   */
  static clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
}
