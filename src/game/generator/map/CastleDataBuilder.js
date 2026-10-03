import { FOUNDATION_HEIGHT } from "./mapGenerationConfig.js";
import { MAP_DIRECTION as DIRECTIONS } from "../../enum/MapDirection.js";
import { MAP_TILE_TYPE as TileType } from "../../enum/MapTileType.js";
import { MapGrid } from "./MapGrid.js";

/**
 * @typedef {import("./MapGenerationTypes.js").MapLayout} MapLayout
 * @typedef {import("./MapGenerationTypes.js").MapCell} MapCell
 * @typedef {import("./MapGenerationTypes.js").GridCell} GridCell
 */

/**
 * Derives castle foundations, entrances, and construction data from the placed footprint.
 */
export class CastleDataBuilder {
  /**
   * @param {number[][]} grid
   * @param {MapLayout} layout
   */
  buildCastleData(grid, layout) {
    const doors = [];
    /**
     *
     * @param {string} side
     * @param {GridCell[]} cells
     * @param {string} inwardDirection
     * @param {number} outsideColOffset
     * @param {number} outsideRowOffset
     */
    const collectGate = (
      side,
      cells,
      inwardDirection,
      outsideColOffset,
      outsideRowOffset,
    ) => {
      if (!cells.length) {
        return;
      }

      let run = [];
      const flushRun = () => {
        if (!run.length) {
          return;
        }
        const verticalSide = side === "WEST" || side === "EAST";
        doors.push({
          side,
          offset:
            (verticalSide ? run[0].row : run[0].col) -
            (verticalSide ? layout.castleTop : layout.castleLeft),
          width: run.length,
          cells: run.map(/**
           *
           * @param {MapCell} cell
           */
          (cell) => ({ ...cell })),
          centerCol: run.reduce(/**
           *
           * @param {number} sum
           * @param {MapCell} cell
           */
          (sum, cell) => sum + cell.col, 0) / run.length,
          centerRow: run.reduce(/**
           *
           * @param {number} sum
           * @param {MapCell} cell
           */
          (sum, cell) => sum + cell.row, 0) / run.length,
          inwardDirection,
        });
        run = [];
      };

      for (const cell of cells) {
        const outsideCol = cell.col + outsideColOffset;
        const outsideRow = cell.row + outsideRowOffset;
        const outsideTile = MapGrid.inBounds(outsideCol, outsideRow)
          ? grid[outsideRow][outsideCol]
          : TileType.WATER;
        if (
          grid[cell.row][cell.col] === TileType.PATH &&
          (outsideTile === TileType.PATH || outsideTile === TileType.ENTRY)
        ) {
          run.push(cell);
        } else {
          flushRun();
        }
      }
      flushRun();
    };

    collectGate(
      "WEST",
      Array.from(
        { length: layout.castleBottom - layout.castleTop + 1 },
        /**
         *
         * @param {undefined} _
         * @param {number} index
         */
        (_, index) => ({
          col: layout.castleLeft,
          row: layout.castleTop + index,
        }),
      ),
      DIRECTIONS.EAST,
      -1,
      0,
    );
    collectGate(
      "EAST",
      Array.from(
        { length: layout.castleBottom - layout.castleTop + 1 },
        /**
         *
         * @param {undefined} _
         * @param {number} index
         */
        (_, index) => ({
          col: layout.castleRight,
          row: layout.castleTop + index,
        }),
      ),
      DIRECTIONS.WEST,
      1,
      0,
    );
    collectGate(
      "NORTH",
      Array.from(
        { length: layout.castleRight - layout.castleLeft + 1 },
        /**
         *
         * @param {undefined} _
         * @param {number} index
         */
        (_, index) => ({
          col: layout.castleLeft + index,
          row: layout.castleTop,
        }),
      ),
      DIRECTIONS.SOUTH,
      0,
      -1,
    );
    collectGate(
      "SOUTH",
      Array.from(
        { length: layout.castleRight - layout.castleLeft + 1 },
        /**
         *
         * @param {undefined} _
         * @param {number} index
         */
        (_, index) => ({
          col: layout.castleLeft + index,
          row: layout.castleBottom,
        }),
      ),
      DIRECTIONS.NORTH,
      0,
      1,
    );

    return {
      position: {
        col: layout.castleLeft,
        row: layout.castleTop,
        width: layout.castleRight - layout.castleLeft + 1,
        depth: layout.castleBottom - layout.castleTop + 1,
        elevation: FOUNDATION_HEIGHT,
      },
      style: layout.castleFootprint.style,
      basePlanId: layout.castleFootprint.basePlanId,
      seed: layout.castleSeed,
      doors,
    };
  }
}
