import {
  SLOPE_DIRECTION,
} from "../../enum/SlopeDirection.js";
import {
  MAP_ROWS,
  PATH_HEIGHT,
  OVERPASS_CHANCE_BY_PATH_COUNT,
  OVERPASS_ELEVATION,
  OVERPASS_RAMP_TILES,
  OVERPASS_HALF_STEP,
  OVERPASS_DECK_THICKNESS,
  OVERPASS_RAISED_ENTRY_CHANCE,
  OVERPASS_STAIR_APPROACH_CHANCE,
  OVERPASS_PLATEAU_RADIUS,
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
  PathTopology,
} from "./PathTopology.js";

/**
 * @typedef {import("./MapGenerationTypes.js").MapLayout} MapLayout
 * @typedef {import("./MapGenerationTypes.js").LayoutEntry} LayoutEntry
 * @typedef {import("./MapGenerationTypes.js").MapCell} MapCell
 * @typedef {import("./MapGenerationTypes.js").OverpassPlan} OverpassPlan
 * @typedef {import("./MapGenerationTypes.js").GridCell} GridCell
 * @typedef {import("./MapGenerationTypes.js").RouteData} RouteData
 * @typedef {import("./MapGenerationTypes.js").PathDipPlan} PathDipPlan
 */

/**
 * Plans grade-separated crossings against carved previews and reserves their entry plateaus.
 */
export class OverpassPlanner {
  /**
   * @type {import("./GenerationRandom.js").GenerationRandom}
   */
  #random;

  /**
   * @type {import("./PathCarver.js").PathCarver}
   */
  #paths;

  /**
   * @param {import("./GenerationRandom.js").GenerationRandom} random
   * @param {import("./PathCarver.js").PathCarver} paths
   */
  constructor(random, paths) {
    this.#random = random;
    this.#paths = paths;
  }

  /**
   * @param {MapLayout} layout
   * @param {boolean|OverpassPlan} requestedOverpass
   */
  selectOverpassPlan(layout, requestedOverpass) {
    if (requestedOverpass === false || layout.entries.length < 2) {
      return null;
    }

    const chance =
      OVERPASS_CHANCE_BY_PATH_COUNT[layout.entries.length] ?? 0;
    if (requestedOverpass !== true && this.#random.rng(1, 100) > chance) {
      return null;
    }

    const trunkTop = layout.pathRows[0];
    const candidates = [];
    for (
      let upperPathIdx = 0;
      upperPathIdx < layout.entries.length;
      upperPathIdx++
    ) {
      const upper = layout.entries[upperPathIdx];
      const upperOffset = upper.gateRows[0] - trunkTop;
      for (
        let lowerPathIdx = 0;
        lowerPathIdx < layout.entries.length;
        lowerPathIdx++
      ) {
        const lower = layout.entries[lowerPathIdx];
        const lowerOffset = lower.gateRows[0] - trunkTop;
        if (
          upperPathIdx === lowerPathIdx ||
          upperOffset === 0 ||
          lowerOffset === 0 ||
          Math.sign(upperOffset) !== Math.sign(lowerOffset) ||
          Math.abs(upperOffset) < Math.abs(lowerOffset) + 5
        ) {
          continue;
        }

        const crossingCol =
          lower.side === "LEFT" ? lower.mergeCol - 4 : lower.mergeCol + 5;
        if (
          crossingCol <= Math.min(lower.gateCol, lower.mergeCol) + 2 ||
          crossingCol >= Math.max(lower.gateCol, lower.mergeCol) - 2
        ) {
          continue;
        }
        const towardTrunk = Math.sign(trunkTop - lower.gateRows[0]);
        const crossingClearanceRows = OVERPASS_RAMP_TILES + 3;
        const landingTop =
          lower.gateRows[0] + towardTrunk * crossingClearanceRows;
        const upperApproachOffset = upper.gateRows[0] - lower.gateRows[0];
        const needsPreparation =
          Math.abs(upperApproachOffset) < crossingClearanceRows;
        const preparationTop =
          lower.gateRows[0] - towardTrunk * crossingClearanceRows;
        const preparationCol =
          upper.side === "LEFT"
            ? Math.min(crossingCol - 4, upper.gateCol + 3)
            : Math.max(crossingCol + 4, upper.gateCol - 4);
        if (
          landingTop < 1 ||
          landingTop + 1 >= MAP_ROWS - 1 ||
          (needsPreparation &&
            (preparationTop < 1 || preparationTop + 1 >= MAP_ROWS - 1))
        ) {
          continue;
        }
        const vertical = {
          pathIdx: upperPathIdx,
          start: {
            col2: crossingCol * 2 + 1,
            row2: upper.gateRows[0] + upper.gateRows[1],
          },
          end: {
            col2: crossingCol * 2 + 1,
            row2: landingTop * 2 + 1,
          },
        };
        const horizontal = {
          pathIdx: lowerPathIdx,
          start: {
            col2: lower.gateCol * 2,
            row2: lower.gateRows[0] + lower.gateRows[1],
          },
          end: {
            col2: lower.mergeCol * 2 + 1,
            row2: lower.gateRows[0] + lower.gateRows[1],
          },
        };
        candidates.push({
          upperPathIdx,
          lowerPathIdx,
          crossingCol,
          landingTop,
          preparationCol,
          preparationTop,
          needsPreparation,
          vertical,
          horizontal,
        });
      }
    }

    if (!candidates.length) {
      return null;
    }
    const originalCurvePlans = layout.entries.map(/**
     *
     * @param {LayoutEntry} entry
     */
    (entry) => entry.curvePlan);
    const shuffledCandidates = this.#random.shuffle([...candidates]);
    for (const selected of shuffledCandidates) {
      for (const entry of layout.entries) {
        entry.curvePlan = null;
      }
      layout.entries[selected.upperPathIdx].curvePlan =
        selected.needsPreparation
          ? {
              turnCols: [selected.preparationCol, selected.crossingCol],
              bands: [
                [selected.preparationTop, selected.preparationTop + 1],
                [selected.landingTop, selected.landingTop + 1],
              ],
            }
          : {
              turnCols: [selected.crossingCol],
              bands: [[selected.landingTop, selected.landingTop + 1]],
            };
      const plan = this.#buildVerticalOverpassPlan(
        selected.vertical,
        selected.horizontal,
        selected.crossingCol * 2 + 1,
        layout.entries[selected.lowerPathIdx].gateRows[0] * 2 + 1,
      );
      const previewGrid = MapGrid.createGrid(TileType.WATER);
      const { routeCellsByPath } = this.#paths.carvePaths(
        previewGrid,
        MapGrid.createTileMetadata(),
        layout,
      );
      if (
        !PathTopology.findUnexpectedFlatPathCrossing(previewGrid, plan) &&
        !PathTopology.findUnexpectedRouteConnection(routeCellsByPath, layout, plan)
      ) {
        return {
          ...plan,
          raisedEntryApproach: this.#random.deterministicChance(
            layout.signature,
            "overpass-raised-entry",
            OVERPASS_RAISED_ENTRY_CHANCE,
          ),
          stairApproach: this.#random.deterministicChance(
            layout.signature,
            "overpass-stair-approach",
            OVERPASS_STAIR_APPROACH_CHANCE,
          ),
        };
      }
    }

    layout.entries.forEach(/**
     *
     * @param {LayoutEntry} entry
     * @param {number} index
     */
    (entry, index) => {
      entry.curvePlan = originalCurvePlans[index];
    });
    return null;
  }

  /**
   * @param {number} vertical
   * @param {number} horizontal
   * @param {number} crossingCol2
   * @param {number} crossingRow2
   */
  #buildVerticalOverpassPlan(
    vertical,
    horizontal,
    crossingCol2,
    crossingRow2,
  ) {
    const col = (crossingCol2 - 1) / 2;
    const row = (crossingRow2 - 1) / 2;
    const crossingCells = [];
    const approachCells = [];
    const slopeCells = [];

    for (let lane = 0; lane < 2; lane++) {
      crossingCells.push({ col: col + lane, row });
      crossingCells.push({ col: col + lane, row: row + 1 });
      approachCells.push({ col: col + lane, row: row - 1 });
      approachCells.push({ col: col + lane, row: row + 2 });
      for (let step = 0; step < OVERPASS_RAMP_TILES; step++) {
        slopeCells.push({
          col: col + lane,
          row: row - OVERPASS_RAMP_TILES - 1 + step,
          lowHeight: PATH_HEIGHT + step * OVERPASS_HALF_STEP,
          highHeight: PATH_HEIGHT + (step + 1) * OVERPASS_HALF_STEP,
          riseDirection: SLOPE_DIRECTION.SOUTH,
        });
        slopeCells.push({
          col: col + lane,
          row: row + 3 + step,
          lowHeight:
            PATH_HEIGHT +
            (OVERPASS_RAMP_TILES - step - 1) * OVERPASS_HALF_STEP,
          highHeight:
            PATH_HEIGHT +
            (OVERPASS_RAMP_TILES - step) * OVERPASS_HALF_STEP,
          riseDirection: SLOPE_DIRECTION.NORTH,
        });
      }
    }
    return {
      id: "path-overpass-0",
      upperPathIdx: vertical.pathIdx,
      lowerPathIdx: horizontal.pathIdx,
      upperDirection:
        vertical.end.row2 > vertical.start.row2
          ? DIRECTIONS.SOUTH
          : DIRECTIONS.NORTH,
      lowerDirection:
        horizontal.end.col2 > horizontal.start.col2
          ? DIRECTIONS.EAST
          : DIRECTIONS.WEST,
      baseElevation: PATH_HEIGHT,
      deckElevation: OVERPASS_ELEVATION,
      deckThickness: OVERPASS_DECK_THICKNESS,
      clearance:
        OVERPASS_ELEVATION -
        OVERPASS_DECK_THICKNESS -
        PATH_HEIGHT,
      crossing: { col, row, width: 2, depth: 2 },
      crossingCells,
      approachCells,
      slopeCells,
    };
  }

  /**
   * @param {OverpassPlan|PathDipPlan} plan
   * @param {boolean[][]} islandMask
   * @param {number[][]} grid
   */
  overpassPlanFits(plan, islandMask, grid) {
    const pathCells = [
      ...plan.crossingCells,
      ...plan.approachCells,
      ...plan.slopeCells,
      ...(plan.raisedApproachCells ?? []),
    ];
    for (const { col, row } of pathCells) {
      const tile = grid[row]?.[col];
      if (
        !MapGrid.inBounds(col, row) ||
        !islandMask[row][col] ||
        (tile !== TileType.PATH && tile !== TileType.ENTRY)
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * @param {number[][]} grid
   * @param {OverpassPlan|PathDipPlan} plan
   * @param {RouteData[]} routeCellsByPath
   */
  configureOverpassEntryPlateau(grid, plan, routeCellsByPath) {
    if (!plan) {
      return;
    }

    plan.raisedApproachCells = [];
    plan.raisedTerrainCells = [];
    if (!plan.raisedEntryApproach) {
      return;
    }

    /**
     *
     * @param {{row: number}} options
     * @param {number} options.row
     */
    const entrySideContains = ({ row }) =>
      plan.upperDirection === DIRECTIONS.SOUTH
        ? row < plan.crossing.row
        : row > plan.crossing.row + plan.crossing.depth - 1;
    const routeCells = routeCellsByPath[plan.upperPathIdx]?.routeCells ?? [];
    const raisedApproachKeys = new Set();
    for (const key of routeCells) {
      const [col, row] = key.split(",").map(Number);
      if (!entrySideContains({ row })) {
        continue;
      }
      const tile = grid[row]?.[col];
      if (tile !== TileType.PATH && tile !== TileType.ENTRY) {
        continue;
      }
      raisedApproachKeys.add(key);
    }

    plan.raisedApproachCells = [...raisedApproachKeys]
      .map(/**
       *
       * @param {string} key
       */
      (key) => {
        const [col, row] = key.split(",").map(Number);
        return { col, row };
      })
      .sort(/**
       *
       * @param {GridCell} left
       * @param {GridCell} right
       */
      (left, right) => left.row - right.row || left.col - right.col);
    plan.slopeCells = plan.slopeCells.filter(
      /**
       *
       * @param {MapCell} cell
       */
      (cell) => !entrySideContains(cell),
    );

    const raisedTerrainKeys = new Set();
    for (const cell of plan.raisedApproachCells) {
      for (
        let row = cell.row - OVERPASS_PLATEAU_RADIUS;
        row <= cell.row + OVERPASS_PLATEAU_RADIUS;
        row += 1
      ) {
        for (
          let col = cell.col - OVERPASS_PLATEAU_RADIUS;
          col <= cell.col + OVERPASS_PLATEAU_RADIUS;
          col += 1
        ) {
          if (!MapGrid.inBounds(col, row) || grid[row][col] !== TileType.GRASS) {
            continue;
          }
          raisedTerrainKeys.add(MapGrid.tileKey(col, row));
        }
      }
    }
    plan.raisedTerrainCells = [...raisedTerrainKeys]
      .map(/**
       *
       * @param {string} key
       */
      (key) => {
        const [col, row] = key.split(",").map(Number);
        return { col, row };
      })
      .sort(/**
       *
       * @param {GridCell} left
       * @param {GridCell} right
       */
      (left, right) => left.row - right.row || left.col - right.col);
  }
}
