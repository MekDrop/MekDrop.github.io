import {
  MAP_COLS,
  MAP_ROWS,
  CASTLE_GROUND_CLEARANCE,
  CASTLE_REAR_GROUND_CLEARANCE,
} from "./mapGenerationConfig.js";
import { MAP_DIRECTION as DIRECTIONS } from "../../enum/MapDirection.js";
import { MAP_TILE_TYPE as TileType } from "../../enum/MapTileType.js";
import { MapGrid } from "./MapGrid.js";

/**
 * @typedef {import("./MapGenerationTypes.js").TileMetadata} TileMetadata
 * @typedef {import("./MapGenerationTypes.js").MapLayout} MapLayout
 */

/**
 * Builds and materializes the island mask, repairing enclosed single-cell holes.
 */
export class IslandBuilder {
  /**
   * @param {boolean[][]} mask
   * @param {number} centerCol
   * @param {number} centerRow
   * @param {number} radiusX
   * @param {number} radiusY
   */
  #addEllipse(mask, centerCol, centerRow, radiusX, radiusY) {
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const dx = (col - centerCol) / radiusX;
        const dy = (row - centerRow) / radiusY;
        if (dx * dx + dy * dy <= 1) {
          mask[row][col] = true;
        }
      }
    }
  }

  /**
   * @param {boolean[][]} mask
   * @param {number} left
   * @param {number} top
   * @param {number} right
   * @param {number} bottom
   */
  #fillMaskRect(mask, left, top, right, bottom) {
    for (
      let row = Math.max(0, top);
      row <= Math.min(MAP_ROWS - 1, bottom);
      row++
    ) {
      for (
        let col = Math.max(0, left);
        col <= Math.min(MAP_COLS - 1, right);
        col++
      ) {
        mask[row][col] = true;
      }
    }
  }

  /**
   * @param {MapLayout} layout
   */
  buildIslandMask(layout) {
    const mask = Array.from({ length: MAP_ROWS }, () =>
      new Array(MAP_COLS).fill(false),
    );

    for (const ellipse of layout.islandEllipses) {
      this.#addEllipse(
        mask,
        ellipse.centerCol,
        ellipse.centerRow,
        ellipse.radiusX,
        ellipse.radiusY,
      );
    }

    for (const entry of layout.entries) {
      const [topRow, bottomRow] = entry.gateRows;
      const curveColumns = entry.curvePlan?.turnCols ?? [];
      const corridorLeft =
        Math.min(entry.gateCol, entry.mergeCol, ...curveColumns) - 1;
      const corridorRight =
        Math.max(
          entry.gateCol,
          entry.mergeCol + 1,
          ...curveColumns.map(/**
           *
           * @param {number} col
           */
          (col) => col + 1),
        ) + 1;
      this.#fillMaskRect(
        mask,
        corridorLeft,
        topRow - 1,
        corridorRight,
        bottomRow + 1,
      );

      if (entry.curvePlan) {
        const curveBands = [
          entry.gateRows,
          ...entry.curvePlan.bands,
          [layout.pathRows[0], layout.pathRows[1]],
        ];
        const minTop = Math.min(...curveBands.map(/**
         *
         * @param {number[]} rows
         */
        (rows) => rows[0]));
        const maxBottom = Math.max(...curveBands.map(/**
         *
         * @param {number[]} rows
         */
        (rows) => rows[1]));
        this.#fillMaskRect(
          mask,
          corridorLeft,
          minTop - 1,
          corridorRight,
          maxBottom + 1,
        );
      }

      for (const row of entry.gateRows) {
        if (entry.inwardDirection === DIRECTIONS.EAST) {
          for (let col = 0; col < entry.gateCol; col++) {
            mask[row][col] = false;
          }
        } else {
          for (let col = entry.gateCol + 1; col < MAP_COLS; col++) {
            mask[row][col] = false;
          }
        }
      }
    }

    this.#fillMaskRect(
      mask,
      10,
      layout.pathRows[0] - 2,
      layout.castleLeft + 1,
      layout.pathRows[1] + 2,
    );
    this.#fillMaskRect(
      mask,
      layout.castleLeft - CASTLE_GROUND_CLEARANCE,
      layout.castleTop - CASTLE_GROUND_CLEARANCE,
      layout.castleRight + CASTLE_REAR_GROUND_CLEARANCE,
      layout.castleBottom + CASTLE_GROUND_CLEARANCE,
    );

    for (const entry of layout.entries) {
      for (const row of entry.gateRows) {
        if (entry.inwardDirection === DIRECTIONS.EAST) {
          for (let col = 0; col < entry.gateCol; col++) {
            mask[row][col] = false;
          }
        } else {
          for (let col = entry.gateCol + 1; col < MAP_COLS; col++) {
            mask[row][col] = false;
          }
        }
      }
    }

    // End the local plateau immediately after the rear grass buffer. Entry
    // corridors cannot overlap this band, so this keeps the castle close to
    // the cliff without removing a valid gate approach.
    for (
      let row = layout.castleTop - CASTLE_GROUND_CLEARANCE;
      row <= layout.castleBottom + CASTLE_GROUND_CLEARANCE;
      row++
    ) {
      for (
        let col = layout.castleRight + CASTLE_REAR_GROUND_CLEARANCE + 1;
        col < MAP_COLS;
        col++
      ) {
        if (MapGrid.inBounds(col, row)) { mask[row][col] = false; }
      }
    }

    this.#fillSingleCellTerrainHoles(mask);
    return mask;
  }

  /**
   * @param {boolean[][]} mask
   */
  #fillSingleCellTerrainHoles(mask) {
    const holes = [];
    for (let row = 1; row < MAP_ROWS - 1; row++) {
      for (let col = 1; col < MAP_COLS - 1; col++) {
        if (mask[row][col]) {
          continue;
        }
        const enclosed = [
          mask[row - 1][col],
          mask[row + 1][col],
          mask[row][col - 1],
          mask[row][col + 1],
        ].every(Boolean);
        if (enclosed) {
          holes.push({ col, row });
        }
      }
    }
    for (const { col, row } of holes) {
      mask[row][col] = true;
    }
  }

  /**
   * @param {number[][]} grid
   * @param {TileMetadata[][]} tileMeta
   * @param {boolean[][]} islandMask
   * @param {number[][]} heightmap
   */
  materializeSingleCellTerrainHoles(
    grid,
    tileMeta,
    islandMask,
    heightmap = null,
  ) {
    const holes = [];
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
          holes.push({ col, row });
        }
      }
    }
    for (const { col, row } of holes) {
      islandMask[row][col] = true;
      if (heightmap) {
        heightmap[row][col] = 1;
      }
      MapGrid.setTile(grid, tileMeta, col, row, TileType.GRASS, {
        surfaceType: "GRASS",
        baseHeight: 1,
      });
    }
  }

  /**
   * @param {number[][]} grid
   * @param {TileMetadata[][]} tileMeta
   * @param {boolean[][]} islandMask
   */
  materializeIsland(grid, tileMeta, islandMask) {
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (!islandMask[row][col]) { continue; }
        MapGrid.setTile(grid, tileMeta, col, row, TileType.GRASS, {
          surfaceType: "GRASS",
          baseHeight: 1,
        });
      }
    }
  }
}
