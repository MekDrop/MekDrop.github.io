import { RIVER_KIND } from "../../enum/RiverKind.js";
import {
  RIVER_SURFACE_INSET,
  LAVA_SURFACE_INSET,
  RIVER_CASTLE_SETBACK,
} from "./mapGenerationConfig.js";
import { MapGrid } from "./MapGrid.js";

/**
 * @typedef {import("./MapGenerationTypes.js").MapLayout} MapLayout
 * @typedef {import("./MapGenerationTypes.js").LayoutEntry} LayoutEntry
 * @typedef {import("./MapGenerationTypes.js").RiverRecord} RiverRecord
 */

/**
 * River setbacks, buffers, and surface levels shared by routing, banks, and validation.
 */
export class RiverPlacementRules {
  /**
   * A terminal fall must face open space all the way to the map boundary.
   * @param {boolean[][]} islandMask
   * @param {number} col
   * @param {number} row
   * @param {number} deltaCol
   * @param {number} deltaRow
   * @returns {boolean}
   */
  static hasClearRiverExit(islandMask, col, row, deltaCol, deltaRow) {
    if (Math.abs(deltaCol) + Math.abs(deltaRow) !== 1) {
      return false;
    }
    for (let nextCol = col + deltaCol, nextRow = row + deltaRow;
      MapGrid.inBounds(nextCol, nextRow);
      nextCol += deltaCol, nextRow += deltaRow) {
      if (islandMask[nextRow][nextCol]) {
        return false;
      }
    }

    return true;
  }

  /**
   * @param {boolean[][]} islandMask
   * @param {number} col
   * @param {number} row
   */
  static hasRiverSourceSetback(islandMask, col, row) {
    for (let deltaRow = -5; deltaRow <= 5; deltaRow++) {
      for (let deltaCol = -5; deltaCol <= 5; deltaCol++) {
        if (Math.abs(deltaCol) + Math.abs(deltaRow) > 5) {
          continue;
        }
        const neighborCol = col + deltaCol;
        const neighborRow = row + deltaRow;
        if (
          !MapGrid.inBounds(neighborCol, neighborRow) ||
          !islandMask[neighborRow][neighborCol]
        ) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * @param {MapLayout} layout
   * @param {number} col
   * @param {number} row
   */
  static isNearCastleForRiver(layout, col, row) {
    return (
      col >= layout.castleLeft - RIVER_CASTLE_SETBACK &&
      col <= layout.castleRight + RIVER_CASTLE_SETBACK &&
      row >= layout.castleTop - RIVER_CASTLE_SETBACK &&
      row <= layout.castleBottom + RIVER_CASTLE_SETBACK
    );
  }

  /**
   * @param {MapLayout} layout
   * @param {number} col
   * @param {number} row
   */
  static isNearGate(layout, col, row) {
    return layout.entries.some(/**
     *
     * @param {LayoutEntry} entry
     */
      (entry) =>
        entry.gateRows.some(
        /**
         *
         * @param {number} gateRow
         */
          (gateRow) =>
            Math.max(Math.abs(entry.gateCol - col), Math.abs(gateRow - row)) <= 1,
        ),
    );
  }

  /**
   * @param {Set<string>} occupiedRiverCells
   * @param {number} col
   * @param {number} row
   */
  static touchesOccupiedRiver(occupiedRiverCells, col, row) {
    for (let deltaRow = -1; deltaRow <= 1; deltaRow++) {
      for (let deltaCol = -1; deltaCol <= 1; deltaCol++) {
        if (
          occupiedRiverCells.has(MapGrid.tileKey(col + deltaCol, row + deltaRow))
        ) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * @param {RiverRecord} river
   */
  static riverSurfaceInset(river) {
    return river.kind === RIVER_KIND.LAVA
      ? LAVA_SURFACE_INSET
      : RIVER_SURFACE_INSET;
  }
}
