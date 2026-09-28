import {
  MAP_COLS,
  MAP_ROWS,
  MIN_RIVER_TILES,
} from "./mapGenerationConfig.js";
import {
  MAP_DIRECTION as DIRECTIONS,
} from "../../enum/MapDirection.js";
import {
  MAP_TILE_TYPE as TileType,
} from "../../enum/MapTileType.js";
import {
  MapGrid,
} from "./MapGrid.js";
import {
  RiverPlacementRules,
} from "./RiverPlacementRules.js";

/**
 * @typedef {import("./MapGenerationTypes.js").TileMetadata} TileMetadata
 * @typedef {import("./MapGenerationTypes.js").MapLayout} MapLayout
 * @typedef {import("./MapGenerationTypes.js").MapCell} MapCell
 * @typedef {import("./MapGenerationTypes.js").GenerationYieldState} GenerationYieldState
 */

/**
 * Searches seeded downstream routes while preserving island connectivity and two-lane crossings.
 */
export class RiverRouter {
  /**
   * @type {import("./GenerationRandom.js").GenerationRandom}
   */
  #random;

  /**
   * @type {(state: import("./MapGenerationTypes.js").GenerationYieldState) => Promise<void>}
   */
  #yieldIfNeeded;

  /**
   * @param {import("./GenerationRandom.js").GenerationRandom} random
   * @param {(state: import("./MapGenerationTypes.js").GenerationYieldState) => Promise<void>} yieldIfNeeded
   */
  constructor(random, yieldIfNeeded) {
    this.#random = random;
    this.#yieldIfNeeded = yieldIfNeeded;
  }

  /**
   * @param {number[][]} grid
   * @param {TileMetadata[][]} tileMeta
   * @param {MapLayout} layout
   * @param {Set<string>} occupiedRiverCells
   * @param {number} col
   * @param {number[]} row
   */
  #isRiverTraversalCell(
    grid,
    tileMeta,
    layout,
    occupiedRiverCells,
    col,
    row,
  ) {
    if (!MapGrid.inBounds(col, row)) {
      return false;
    }
    if (RiverPlacementRules.touchesOccupiedRiver(occupiedRiverCells, col, row)) {
      return false;
    }
    if (RiverPlacementRules.isNearCastleForRiver(layout, col, row)) {
      return false;
    }
    if (tileMeta[row][col].overpassId || tileMeta[row][col].overpassPlateauId) {
      return false;
    }

    const tile = grid[row][col];
    return tile === TileType.GRASS || tile === TileType.PATH;
  }

  /**
   * @param {number[][]} grid
   * @param {MapCell[]} route
   */
  riverSourceHasEarthEnclosure(grid, route) {
    if (route.length < 2) {
      return false;
    }
    const source = route[0];
    const routeCells = new Set(
      route.map(/**
       *
       * @param {MapCell} cell
       */
      (cell) => MapGrid.tileKey(cell.col, cell.row)),
    );
    for (let deltaRow = -1; deltaRow <= 1; deltaRow++) {
      for (let deltaCol = -1; deltaCol <= 1; deltaCol++) {
        if (deltaCol === 0 && deltaRow === 0) {
          continue;
        }
        const col = source.col + deltaCol;
        const row = source.row + deltaRow;
        if (routeCells.has(MapGrid.tileKey(col, row))) {
          continue;
        }
        if (!MapGrid.inBounds(col, row) || grid[row][col] !== TileType.GRASS) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * @param {number[][]} grid
   * @param {boolean[][]} islandMask
   * @param {MapLayout} layout
   * @param {MapCell[]} route
   */
  #riverTerminalDirection(grid, islandMask, layout, route) {
    if (route.length < MIN_RIVER_TILES) {
      return null;
    }
    const terminal = route[route.length - 1];
    const previous = route[route.length - 2];
    if (
      grid[terminal.row][terminal.col] !== TileType.GRASS ||
      RiverPlacementRules.isNearGate(layout, terminal.col, terminal.row) ||
      RiverPlacementRules.isNearCastleForRiver(layout, terminal.col, terminal.row)
    ) {
      return null;
    }

    const deltaCol = terminal.col - previous.col;
    const deltaRow = terminal.row - previous.row;
    const outsideCol = terminal.col + deltaCol;
    const outsideRow = terminal.row + deltaRow;
    if (
      MapGrid.inBounds(outsideCol, outsideRow) &&
      islandMask[outsideRow][outsideCol]
    ) {
      return null;
    }
    const crossCol = -deltaRow;
    const crossRow = deltaCol;
    for (const side of [-1, 1]) {
      if (
        !MapGrid.inBounds(
          outsideCol + crossCol * side,
          outsideRow + crossRow * side,
        )
      ) {
        return null;
      }
    }
    return MapGrid.directionFromStep(previous, terminal);
  }

  /**
   * @param {Map<string, string|null>} parents
   * @param {string} terminalKey
   */
  #reconstructRiverRoute(parents, terminalKey) {
    const route = [];
    let key = terminalKey;
    while (key) {
      const [col, row] = key.split(",").map(Number);
      route.push({ col, row });
      key = parents.get(key) ?? null;
    }
    route.reverse();
    return route;
  }

  /**
   * @param {number[][]} grid
   * @param {TileMetadata[][]} tileMeta
   * @param {boolean[][]} islandMask
   * @param {MapLayout} layout
   * @param {MapCell} source
   * @param {Set<string>} occupiedRiverCells
   * @param {GenerationYieldState} yieldState
   */
  async findRiverRoute(
    grid,
    tileMeta,
    islandMask,
    layout,
    source,
    occupiedRiverCells,
    yieldState,
  ) {
    const sourceKey = MapGrid.tileKey(source.col, source.row);
    const parents = new Map([[sourceKey, null]]);
    const queue = [{ ...source }];
    let queueIndex = 0;

    while (queueIndex < queue.length) {
      await this.#yieldIfNeeded(yieldState);
      const current = queue[queueIndex++];
      const currentKey = MapGrid.tileKey(current.col, current.row);
      const route = this.#reconstructRiverRoute(parents, currentKey);
      const terminalDirection = this.#riverTerminalDirection(
        grid,
        islandMask,
        layout,
        route,
      );
      if (
        terminalDirection &&
        this.#validateRiverPathCrossings(grid, tileMeta, route) &&
        this.#riverRouteKeepsIslandConnected(grid, route)
      ) {
        return { route, terminalDirection };
      }

      const neighbors = this.#random.shuffle([
        { col: current.col - 1, row: current.row },
        { col: current.col + 1, row: current.row },
        { col: current.col, row: current.row - 1 },
        { col: current.col, row: current.row + 1 },
      ]);
      for (const neighbor of neighbors) {
        const neighborKey = MapGrid.tileKey(neighbor.col, neighbor.row);
        if (parents.has(neighborKey)) {
          continue;
        }
        if (
          !this.#isRiverTraversalCell(
            grid,
            tileMeta,
            layout,
            occupiedRiverCells,
            neighbor.col,
            neighbor.row,
          )
        ) {
          continue;
        }
        parents.set(neighborKey, currentKey);
        queue.push(neighbor);
      }
    }
    return null;
  }

  /**
   * @param {number[][]} grid
   * @param {MapCell[]} route
   */
  #riverRouteKeepsIslandConnected(grid, route) {
    const trialGrid = grid.map(/**
     *
     * @param {number[]} row
     */
    (row) => [...row]);
    for (const cell of route) {
      if (trialGrid[cell.row][cell.col] === TileType.GRASS) {
        trialGrid[cell.row][cell.col] = TileType.WATER;
      }
    }

    const land = [];
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (trialGrid[row][col] !== TileType.WATER) {
          land.push({ col, row });
        }
      }
    }
    return (
      land.length > 0 &&
      MapGrid.findConnectedComponent(trialGrid, [land[0]]).size === land.length
    );
  }

  /**
   * @param {number[][]} grid
   * @param {TileMetadata[][]} tileMeta
   * @param {MapCell[]} route
   */
  #validateRiverPathCrossings(grid, tileMeta, route) {
    for (let index = 0; index < route.length; index++) {
      const cell = route[index];
      if (grid[cell.row][cell.col] !== TileType.PATH) {
        continue;
      }

      const start = index;
      while (
        index + 1 < route.length &&
        grid[route[index + 1].row][route[index + 1].col] === TileType.PATH
      ) {
        index++;
      }
      const end = index;
      if (end - start + 1 !== 2 || start === 0 || end >= route.length - 1) {
        return false;
      }
      if (
        route
          .slice(start, end + 1)
          .some(/**
           *
           * @param {MapCell} pathCell
           */
          (pathCell) => tileMeta[pathCell.row][pathCell.col].overpassId)
      ) {
        return false;
      }

      const before = route[start - 1];
      const first = route[start];
      const last = route[end];
      const after = route[end + 1];
      const riverDirection = MapGrid.directionFromStep(before, first);
      if (
        riverDirection === DIRECTIONS.NONE ||
        MapGrid.directionFromStep(first, last) !== riverDirection ||
        MapGrid.directionFromStep(last, after) !== riverDirection
      ) {
        return false;
      }

      const pathDirection = tileMeta[first.row][first.col].direction;
      if (tileMeta[last.row][last.col].direction !== pathDirection) {
        return false;
      }
      const riverIsHorizontal =
        riverDirection === DIRECTIONS.EAST ||
        riverDirection === DIRECTIONS.WEST;
      const pathIsHorizontal =
        pathDirection === DIRECTIONS.EAST ||
        pathDirection === DIRECTIONS.WEST;
      if (riverIsHorizontal === pathIsHorizontal) {
        return false;
      }
    }
    return true;
  }
}
