import {
  CastleEntrancePathMissingError,
  EntryPathUnreachableError,
  GatePathMissingError,
  InsufficientCastleClearanceError,
  InsufficientEntryPathSpacingError,
  InsufficientParallelPathSpacingError,
  InvalidCastleEntranceWidthError,
  InvalidGatePositionError,
  PathOutsideGateError,
  UnexpectedPathConnectionError,
  UnexpectedPathCrossingError,
} from "../../errors/map/index.js";
import {
  CASTLE_GROUND_CLEARANCE,
  CASTLE_REAR_GROUND_CLEARANCE,
} from "./mapGenerationConfig.js";
import { MAP_DIRECTION as DIRECTIONS } from "../../enum/MapDirection.js";
import { MAP_TILE_TYPE as TileType } from "../../enum/MapTileType.js";
import { MapGrid } from "./MapGrid.js";
import { PathTopology } from "./PathTopology.js";

/**
 * @typedef {import("./MapGenerationTypes.js").MapLayout} MapLayout
 * @typedef {import("./MapGenerationTypes.js").OverpassPlan} OverpassPlan
 * @typedef {import("./MapGenerationTypes.js").RouteData} RouteData
 */

/**
 * Validates gate boundaries, route separation, reachability, and castle access.
 */
export class RouteValidator {
  /**
   * @param {number[][]} grid
   * @param {MapLayout} layout
   */
  validateGatePlacement(grid, layout) {
    for (const entry of layout.entries) {
      const outsideCol =
        entry.inwardDirection === DIRECTIONS.WEST
          ? entry.gateCol + 1
          : entry.gateCol - 1;
      const insideCol =
        entry.inwardDirection === DIRECTIONS.WEST
          ? entry.gateCol - 1
          : entry.gateCol + 1;

      for (const row of entry.gateRows) {
        if (grid[row][entry.gateCol] !== TileType.ENTRY) {
          throw new InvalidGatePositionError();
        }
        if (
          MapGrid.inBounds(outsideCol, row) &&
          grid[row][outsideCol] !== TileType.WATER
        ) {
          throw new PathOutsideGateError();
        }
        if (
          !MapGrid.inBounds(insideCol, row) ||
          grid[row][insideCol] !== TileType.PATH
        ) {
          throw new GatePathMissingError();
        }
      }
    }
  }

  /**
   * @param {MapLayout} layout
   */
  validatePathSpacing(layout) {
    for (let i = 0; i < layout.entries.length; i++) {
      for (let j = i + 1; j < layout.entries.length; j++) {
        const aBottom = layout.entries[i].gateRows[1];
        const bTop = layout.entries[j].gateRows[0];
        if (bTop - aBottom < 3) {
          throw new InsufficientEntryPathSpacingError();
        }
      }
    }
  }

  /**
   * @param {RouteData[]} routeCellsByPath
   * @param {MapLayout} layout
   */
  validateRouteSeparation(routeCellsByPath, layout) {
    const connection = PathTopology.findUnexpectedRouteConnection(
      routeCellsByPath,
      layout,
      layout.overpassPlan,
    );
    if (connection) {
      throw new UnexpectedPathConnectionError(connection);
    }
  }

  /**
   * @param {number[][]} grid
   * @param {MapLayout} layout
   */
  validateParallelPathClearance(grid, layout) {
    if (PathTopology.hasInsufficientParallelPathClearance(grid, layout)) {
      throw new InsufficientParallelPathSpacingError();
    }
  }

  /**
   * @param {number[][]} grid
   * @param {OverpassPlan|null} overpassPlan
   */
  validateFlatPathCrossings(grid, overpassPlan) {
    const crossing = PathTopology.findUnexpectedFlatPathCrossing(grid, overpassPlan);
    if (crossing) {
      throw new UnexpectedPathCrossingError(crossing);
    }
  }

  /**
   * @param {number[][]} grid
   * @param {MapLayout} layout
   */
  validateRouteReachability(grid, layout) {
    const entranceTargets = layout.castleEntranceRows.map(/**
     *
     * @param {number} row
     */
    (row) =>
      MapGrid.tileKey(layout.castleEntranceCol, row),
    );

    for (const entry of layout.entries) {
      const seen = new Set();
      const queue = entry.gateRows.map(/**
       *
       * @param {number} row
       */
      (row) => ({ col: entry.gateCol, row }));

      while (queue.length) {
        const current = queue.shift();
        const key = MapGrid.tileKey(current.col, current.row);
        if (seen.has(key)) { continue; }
        if (!MapGrid.inBounds(current.col, current.row)) { continue; }
        const tile = grid[current.row][current.col];
        if (tile !== TileType.PATH && tile !== TileType.ENTRY) { continue; }
        seen.add(key);
        for (const [dc, dr] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          queue.push({ col: current.col + dc, row: current.row + dr });
        }
      }

      if (!entranceTargets.some(/**
       *
       * @param {string} key
       */
      (key) => seen.has(key))) {
        throw new EntryPathUnreachableError();
      }
    }
  }

  /**
   * @param {number[][]} grid
   * @param {MapLayout} layout
   */
  validateCastleEntrance(grid, layout) {
    const entranceRows = [...layout.castleEntranceRows].sort(
      /**
       *
       * @param {number} left
       * @param {number} right
       */
      (left, right) => left - right,
    );
    if (entranceRows.length !== 2 || entranceRows[1] !== entranceRows[0] + 1) {
      throw new InvalidCastleEntranceWidthError();
    }

    for (const row of entranceRows) {
      if (grid[row][layout.castleEntranceCol] !== TileType.PATH) {
        throw new CastleEntrancePathMissingError();
      }
    }
  }

  /**
   * @param {number[][]} grid
   * @param {MapLayout} layout
   */
  validateCastleGroundClearance(grid, layout) {
    for (
      let row = layout.castleTop - CASTLE_GROUND_CLEARANCE;
      row <= layout.castleBottom + CASTLE_GROUND_CLEARANCE;
      row++
    ) {
      for (
        let col = layout.castleLeft - CASTLE_GROUND_CLEARANCE;
        col <= layout.castleRight + CASTLE_REAR_GROUND_CLEARANCE;
        col++
      ) {
        if (!MapGrid.inBounds(col, row) || grid[row][col] === TileType.WATER) {
          throw new InsufficientCastleClearanceError();
        }
      }
    }
  }
}
