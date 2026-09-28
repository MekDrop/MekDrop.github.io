import { MAP_COLS, MAP_ROWS } from "./mapGenerationConfig.js";
import { MapGrid } from "./MapGrid.js";

/**
 * @typedef {import("./MapGenerationTypes.js").MapLayout} MapLayout
 * @typedef {import("./MapGenerationTypes.js").MapCell} MapCell
 * @typedef {import("./MapGenerationTypes.js").OverpassPlan} OverpassPlan
 * @typedef {import("./MapGenerationTypes.js").RouteData} RouteData
 */

/**
 * Shared route-contact rules used while choosing layouts and during final validation.
 */
export class PathTopology {
  /**
   * @param {MapLayout} layout
   * @param {number} col
   * @param {number} row
   */
  static #isWithinMergeZone(layout, col, row) {
    const mergeCol = layout.entries[0]?.mergeCol;
    if (!Number.isFinite(mergeCol)) {
      return false;
    }
    return (
      col >= mergeCol &&
      col <= mergeCol + 1 &&
      row >= layout.pathRows[0] &&
      row <= layout.pathRows[1]
    );
  }

  /**
   * @param {MapLayout} layout
   * @param {number} col
   */
  static #isWithinMergeCorridor(layout, col) {
    const mergeCol = layout.entries[0]?.mergeCol;
    return Number.isFinite(mergeCol) && col >= mergeCol && col <= mergeCol + 1;
  }

  /**
   * @param {Set<string>} firstCells
   * @param {Set<string>} secondCells
   * @param {MapLayout} layout
   * @param {number} row
   */
  static #routesShareMergeCellAtRow(firstCells, secondCells, layout, row) {
    const mergeCol = layout.entries[0]?.mergeCol;
    if (!Number.isFinite(mergeCol)) {
      return false;
    }
    return [mergeCol, mergeCol + 1].some(/**
     *
     * @param {number} col
     */
    (col) => {
      const key = MapGrid.tileKey(col, row);
      return firstCells.has(key) && secondCells.has(key);
    });
  }

  /**
   * @param {Set<string>} firstCells
   * @param {Set<string>} secondCells
   * @param {MapLayout} layout
   * @param {MapCell} firstCell
   * @param {MapCell} secondCell
   */
  static #isPlannedMergeContact(
    firstCells,
    secondCells,
    layout,
    firstCell,
    secondCell,
  ) {
    if (
      !PathTopology.#isWithinMergeCorridor(layout, firstCell.col) &&
      !PathTopology.#isWithinMergeCorridor(layout, secondCell.col)
    ) {
      return false;
    }
    return [firstCell.row, secondCell.row].some(/**
     *
     * @param {number} row
     */
    (row) =>
      PathTopology.#routesShareMergeCellAtRow(firstCells, secondCells, layout, row),
    );
  }

  /**
   * @param {OverpassPlan|null} overpassPlan
   * @param {number} col
   * @param {number} row
   */
  static #isWithinOverpassCrossing(overpassPlan, col, row) {
    if (!overpassPlan) {
      return false;
    }
    const { crossing } = overpassPlan;
    return (
      col >= crossing.col &&
      col < crossing.col + crossing.width &&
      row >= crossing.row &&
      row < crossing.row + crossing.depth
    );
  }

  /**
   * @param {RouteData[]} routeCellsByPath
   * @param {MapLayout} layout
   * @param {OverpassPlan|null} overpassPlan
   */
  static findUnexpectedRouteConnection(
    routeCellsByPath,
    layout,
    overpassPlan,
  ) {
    const neighborOffsets = [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    for (
      let firstIndex = 0;
      firstIndex < routeCellsByPath.length;
      firstIndex++
    ) {
      const firstCells = routeCellsByPath[firstIndex].routeCells;
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < routeCellsByPath.length;
        secondIndex++
      ) {
        const secondCells = routeCellsByPath[secondIndex].routeCells;
        for (const key of firstCells) {
          const [col, row] = key.split(",").map(Number);
          for (const [deltaCol, deltaRow] of neighborOffsets) {
            const neighborCol = col + deltaCol;
            const neighborRow = row + deltaRow;
            if (!secondCells.has(MapGrid.tileKey(neighborCol, neighborRow))) {
              continue;
            }
            if (
              PathTopology.#isPlannedMergeContact(
                firstCells,
                secondCells,
                layout,
                { col, row },
                { col: neighborCol, row: neighborRow },
              ) ||
              PathTopology.#isWithinOverpassCrossing(overpassPlan, col, row) ||
              PathTopology.#isWithinOverpassCrossing(
                overpassPlan,
                neighborCol,
                neighborRow,
              )
            ) {
              continue;
            }
            return {
              firstPathIndex: firstIndex,
              secondPathIndex: secondIndex,
              col,
              row,
            };
          }
        }
      }
    }
    return null;
  }

  /**
   * @param {number[][]} grid
   * @param {MapLayout} layout
   */
  static hasInsufficientParallelPathClearance(grid, layout) {
    for (let col = 0; col < MAP_COLS; col++) {
      const horizontalBands = [];
      for (let row = 0; row < MAP_ROWS - 1; row++) {
        if (
          !MapGrid.isRouteTile(grid[row][col]) ||
          !MapGrid.isRouteTile(grid[row + 1][col])
        )
          { continue; }
        if (row > 0 && MapGrid.isRouteTile(grid[row - 1][col])) { continue; }
        horizontalBands.push(row);
      }

      for (let i = 0; i < horizontalBands.length; i++) {
        for (let j = i + 1; j < horizontalBands.length; j++) {
          const topStart = horizontalBands[i];
          const bottomStart = horizontalBands[j];
          if (bottomStart - topStart >= 4) { continue; }
          const topInMerge =
            PathTopology.#isWithinMergeZone(layout, col, topStart) ||
            PathTopology.#isWithinMergeZone(layout, col, topStart + 1);
          const bottomInMerge =
            PathTopology.#isWithinMergeZone(layout, col, bottomStart) ||
            PathTopology.#isWithinMergeZone(layout, col, bottomStart + 1);
          if (topInMerge && bottomInMerge) { continue; }
          return true;
        }
      }
    }

    for (let row = 0; row < MAP_ROWS; row++) {
      const verticalBands = [];
      for (let col = 0; col < MAP_COLS - 1; col++) {
        if (
          !MapGrid.isRouteTile(grid[row][col]) ||
          !MapGrid.isRouteTile(grid[row][col + 1])
        )
          { continue; }
        if (col > 0 && MapGrid.isRouteTile(grid[row][col - 1])) { continue; }
        verticalBands.push(col);
      }

      for (let i = 0; i < verticalBands.length; i++) {
        for (let j = i + 1; j < verticalBands.length; j++) {
          const leftStart = verticalBands[i];
          const rightStart = verticalBands[j];
          if (rightStart - leftStart >= 4) { continue; }
          const leftInMerge =
            PathTopology.#isWithinMergeZone(layout, leftStart, row) ||
            PathTopology.#isWithinMergeZone(layout, leftStart + 1, row);
          const rightInMerge =
            PathTopology.#isWithinMergeZone(layout, rightStart, row) ||
            PathTopology.#isWithinMergeZone(layout, rightStart + 1, row);
          if (leftInMerge && rightInMerge) { continue; }
          return true;
        }
      }
    }
    return false;
  }

  /**
   * @param {number[][]} grid
   * @param {OverpassPlan|null} overpassPlan
   */
  static findUnexpectedFlatPathCrossing(grid, overpassPlan) {
    /**
     *
     * @param {number} firstCol
     * @param {number} firstRow
     * @param {number} secondCol
     * @param {number} secondRow
     */
    const isRoutePair = (firstCol, firstRow, secondCol, secondRow) =>
      MapGrid.inBounds(firstCol, firstRow) &&
      MapGrid.inBounds(secondCol, secondRow) &&
      MapGrid.isRouteTile(grid[firstRow][firstCol]) &&
      MapGrid.isRouteTile(grid[secondRow][secondCol]);

    for (let row = 0; row < MAP_ROWS - 1; row += 1) {
      for (let col = 0; col < MAP_COLS - 1; col += 1) {
        if (
          !isRoutePair(col, row, col + 1, row) ||
          !isRoutePair(col, row + 1, col + 1, row + 1)
        ) {
          continue;
        }
        const continuesNorth = isRoutePair(col, row - 1, col + 1, row - 1);
        const continuesSouth = isRoutePair(col, row + 2, col + 1, row + 2);
        const continuesWest = isRoutePair(col - 1, row, col - 1, row + 1);
        const continuesEast = isRoutePair(col + 2, row, col + 2, row + 1);
        if (
          !continuesNorth ||
          !continuesSouth ||
          !continuesWest ||
          !continuesEast
        ) {
          continue;
        }
        if (
          overpassPlan?.crossing.col === col &&
          overpassPlan.crossing.row === row
        ) {
          continue;
        }
        return { col, row };
      }
    }
    return null;
  }
}
