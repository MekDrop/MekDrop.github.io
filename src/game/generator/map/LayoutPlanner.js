import {
  MAP_COLS,
  MAP_ROWS,
  DEFAULT_MIN_PATHS,
  DEFAULT_MAX_PATHS,
  LEFT_GATE_COL,
  RIGHT_GATE_COL,
  CASTLE_REAR_GROUND_CLEARANCE,
  CASTLE_FOOTPRINTS,
  ENTRY_TEMPLATES,
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
 * @typedef {import("./MapGenerationTypes.js").GenerationTemplate} GenerationTemplate
 * @typedef {import("./MapGenerationTypes.js").MapGenerationOptions} MapGenerationOptions
 */

/**
 * Chooses castle, island, entry bands, and separated curves using one seeded stream.
 */
export class LayoutPlanner {
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
   * @param {number} numPaths
   * @param {{basePlanId:string,entranceInset:number,width:number,depth:number}} [authoredPlan]
   */
  createLayoutConfig(numPaths, authoredPlan) {
    const anchorRows = ENTRY_TEMPLATES.map(/**
     *
     * @param {GenerationTemplate} template
     */
    (template) => [
      ...template.gateRows,
    ]);
    let pathRows =
      numPaths > 1
        ? this.#random.randomItem([anchorRows[0], anchorRows[anchorRows.length - 1]])
        : anchorRows[this.#random.rng(0, anchorRows.length - 1)];
    const castleFootprintIndex =
      numPaths >= 4
        ? 1
        : numPaths === 3
          ? 2
          : pathRows[0] <= 6 || pathRows[1] >= 25
            ? 0
            : 3;
    const castleFootprint = { ...CASTLE_FOOTPRINTS[castleFootprintIndex], ...authoredPlan };
    // Keep the castle against the rear of its buildable plateau. The footprint
    // still varies by width and row, while the required grass clearance remains
    // between the back wall and the island edge.
    const castleRight = MAP_COLS - CASTLE_REAR_GROUND_CLEARANCE - 2;
    const castleLeft = castleRight - castleFootprint.width + 1;
    const entranceOffset = Math.round((authoredPlan?.entranceInset !== undefined ? castleFootprint.depth / 2 + authoredPlan.entranceInset : castleFootprint.entranceFraction * castleFootprint.depth) - 1);
    const castleTop = MapGrid.clamp(pathRows[0] - entranceOffset, 4, MAP_ROWS - castleFootprint.depth - 4);
    pathRows = [castleTop + entranceOffset, castleTop + entranceOffset + 1];
    const castleCenterRow = castleTop + Math.floor(castleFootprint.depth / 2);
    const castleBottom = castleTop + castleFootprint.depth - 1;
    const castleEntranceRows = [...pathRows];
    const entries = this.#selectEntries(
      numPaths,
      castleLeft,
      castleTop,
      castleBottom,
      pathRows,
    );
    const islandEllipses = [
      {
        centerCol: this.#random.rng(20, 24),
        centerRow: MapGrid.clamp(castleCenterRow + this.#random.rng(-2, 2), 11, 28),
        radiusX: this.#random.rng(15, 19),
        radiusY: this.#random.rng(10, 13),
      },
      {
        centerCol: this.#random.rng(12, 18),
        centerRow: MapGrid.clamp(castleCenterRow + this.#random.rng(-4, 1), 10, 24),
        radiusX: this.#random.rng(9, 13),
        radiusY: this.#random.rng(7, 10),
      },
      {
        centerCol: this.#random.rng(11, 18),
        centerRow: MapGrid.clamp(castleCenterRow + this.#random.rng(6, 12), 19, 32),
        radiusX: this.#random.rng(8, 12),
        radiusY: this.#random.rng(5, 8),
      },
      {
        centerCol: MapGrid.clamp(castleLeft + this.#random.rng(1, 5), 26, 35),
        centerRow: MapGrid.clamp(castleCenterRow + this.#random.rng(-3, 1), 10, 27),
        radiusX: this.#random.rng(8, 11),
        radiusY: this.#random.rng(6, 9),
      },
    ];
    const hillEllipses = [
      {
        centerCol: this.#random.rng(18, 24),
        centerRow: MapGrid.clamp(castleCenterRow + this.#random.rng(-1, 2), 11, 28),
        radiusX: 13,
        radiusY: 9,
        height: 2,
      },
      {
        centerCol: MapGrid.clamp(castleLeft + 2, 20, 34),
        centerRow: MapGrid.clamp(castleCenterRow + this.#random.rng(-1, 1), 11, 28),
        radiusX: 8,
        radiusY: 6,
        height: 3,
      },
      {
        centerCol: this.#random.rng(12, 18),
        centerRow: MapGrid.clamp(castleCenterRow + this.#random.rng(7, 10), 20, 33),
        radiusX: 8,
        radiusY: 5,
        height: 2,
      },
    ];

    return {
      castleLeft,
      castleRight,
      castleTop,
      castleBottom,
      castleCenterRow,
      castleFootprint,
      castleEntranceCol: castleLeft,
      pathRows,
      castleEntranceRows,
      entries,
      islandEllipses,
      hillEllipses,
    };
  }

  /**
   * @param {number[]} rows
   * @param {number} top
   * @param {number} bottom
   */
  #rowsOverlap(rows, top, bottom) {
    return rows[0] <= bottom && rows[1] >= top;
  }

  /**
   * @param {number} numPaths
   * @param {number} castleLeft
   * @param {number} castleTop
   * @param {number} castleBottom
   * @param {number[]} pathRows
   */
  #selectEntries(
    numPaths,
    castleLeft,
    castleTop,
    castleBottom,
    pathRows,
  ) {
    const requested = Number.isFinite(numPaths)
      ? Math.round(numPaths)
      : this.#random.rng(DEFAULT_MIN_PATHS, DEFAULT_MAX_PATHS);
    const count = MapGrid.clamp(requested, 1, ENTRY_TEMPLATES.length);
    const shuffled = this.#random.shuffle([...ENTRY_TEMPLATES]);
    const selected = shuffled
      .slice(0, count)
      .sort(/**
       *
       * @param {number} a
       * @param {number} b
       */
      (a, b) => a.gateRows[0] - b.gateRows[0]);
    const sharedMinMerge = Math.max(
      ...selected.map(/**
       *
       * @param {GenerationTemplate} template
       */
      (template) => template.mergeRange[0]),
    );
    const sharedMaxMerge = Math.min(
      castleLeft - 6,
      ...selected.map(/**
       *
       * @param {GenerationTemplate} template
       */
      (template) => template.mergeRange[1]),
    );
    const mergeCol = this.#random.rng(sharedMinMerge, sharedMaxMerge);
    const sides = selected.map(/**
     *
     * @param {GenerationTemplate} template
     */
    (template) => {
      if (
        this.#rowsOverlap(template.gateRows, castleTop - 5, castleBottom + 5)
      ) {
        return "LEFT";
      }
      return this.#random.rng(0, 1) === 0 ? "LEFT" : "RIGHT";
    });

    if (selected.length > 1 && sides.every(/**
     *
     * @param {string} side
     */
    (side) => side === sides[0])) {
      const candidateIndexes = selected
        .map(/**
         *
         * @param {GenerationTemplate} template
         * @param {number} index
         */
        (template, index) => ({ template, index }))
        .filter(
          /**
           *
           * @param {{template: MapGenerationOptions}} options
           * @param {MapGenerationOptions} options.template
           */
          ({ template }) =>
            !this.#rowsOverlap(
              template.gateRows,
              castleTop - 5,
              castleBottom + 5,
            ),
        )
        .map(/**
         *
         * @param {{index: number}} options
         * @param {number} options.index
         */
        ({ index }) => index);

      if (candidateIndexes.length) {
        const flipIndex =
          candidateIndexes[this.#random.rng(0, candidateIndexes.length - 1)];
        sides[flipIndex] = sides[0] === "LEFT" ? "RIGHT" : "LEFT";
      }
    }

    return selected.map(/**
     *
     * @param {GenerationTemplate} template
     * @param {number} index
     */
    (template, index) => {
      const side = sides[index];
      const entry = {
        ...template,
        side,
        gateCol: side === "LEFT" ? LEFT_GATE_COL : RIGHT_GATE_COL,
        inwardDirection:
          side === "LEFT" ? DIRECTIONS.EAST : DIRECTIONS.WEST,
        mergeCol,
      };
      return {
        ...entry,
        curvePlan: this.#buildCurvePlan(
          entry,
          pathRows,
          mergeCol,
          selected.map(/**
           *
           * @param {{gateRows: number[]}} candidate
           */
          (candidate) => candidate.gateRows[0]),
        ),
      };
    });
  }

  /**
   * @param {LayoutEntry} entry
   * @param {number[]} pathRows
   * @param {number} mergeCol
   * @param {Array} occupiedBandStarts
   */
  #buildCurvePlan(entry, pathRows, mergeCol, occupiedBandStarts) {
    const [topRow, bottomRow] = entry.gateRows;
    const [trunkTop, trunkBottom] = pathRows;
    const safeBands =
      bottomRow < trunkTop
        ? this.#collectSafeCurveBandStarts(
            bottomRow + 1,
            trunkTop - 4,
            occupiedBandStarts,
            pathRows[0],
            1,
          )
        : topRow > trunkBottom
          ? this.#collectSafeCurveBandStarts(
              trunkBottom + 3,
              topRow - 2,
              occupiedBandStarts,
              pathRows[0],
              -1,
            )
          : [];

    if (!safeBands.length) {
      return null;
    }

    const bandStarts = this.#selectCurveBandStarts(safeBands);
    const turnCols = this.#pickCurveTurnCols(
      entry.side,
      entry.gateCol,
      mergeCol,
      bandStarts.length,
    );
    if (!turnCols.length) {
      return null;
    }

    return {
      turnCols,
      bands: bandStarts
        .slice(0, turnCols.length)
        .map(/**
         *
         * @param {number} start
         */
        (start) => [start, start + 1]),
    };
  }

  /**
   * @param {MapLayout} layout
   */
  retainSeparatedCurvePlans(layout) {
    // An entry on the trunk plus branches above and below would form a flat
    // four-way crossing at their shared merge. Use separated T junctions.
    if (layout.entries.every(/**
                             * @param {LayoutEntry} entry
                             */ (entry) => entry.mergeCol === layout.entries[0].mergeCol) &&
      layout.entries.some(/**
                             * @param {LayoutEntry} entry
                             */
      (entry) => entry.gateRows[0] === layout.pathRows[0]) &&
      layout.entries.some(/**
                           * @param {LayoutEntry} entry
                           */
        (entry) => entry.gateRows[1] < layout.pathRows[0]) &&
      layout.entries.some(/**
                           * @param {LayoutEntry} entry
                           */
        (entry) => entry.gateRows[0] > layout.pathRows[1])) {
      for (const entry of layout.entries) {
        if (entry.gateRows[0] >= layout.pathRows[0]) {
          entry.mergeCol -= 4;
          entry.curvePlan = null;
        }
      }
    }
    const curvePlans = layout.entries.map(/**
     *
     * @param {LayoutEntry} entry
     */
    (entry) => entry.curvePlan);
    for (const entry of layout.entries) {
      entry.curvePlan = null;
    }

    for (let index = 0; index < layout.entries.length; index++) {
      const curvePlan = curvePlans[index];
      if (!curvePlan) {
        continue;
      }

      layout.entries[index].curvePlan = curvePlan;
      const previewGrid = MapGrid.createGrid(TileType.WATER);
      const { routeCellsByPath } = this.#paths.carvePaths(
        previewGrid,
        MapGrid.createTileMetadata(),
        layout,
      );
      if (
        PathTopology.findUnexpectedFlatPathCrossing(previewGrid, null) ||
        PathTopology.hasInsufficientParallelPathClearance(previewGrid, layout) ||
        PathTopology.findUnexpectedRouteConnection(routeCellsByPath, layout, null)
      ) {
        layout.entries[index].curvePlan = null;
      }
    }
  }

  /**
   * @param {number} min
   * @param {number} max
   * @param {Array} occupiedBandStarts
   * @param {pc.Vec3} trunkTop
   * @param {string} direction
   */
  #collectSafeCurveBandStarts(
    min,
    max,
    occupiedBandStarts,
    trunkTop,
    direction,
  ) {
    if (min > max) {
      return [];
    }

    const blocked = occupiedBandStarts.concat(trunkTop);
    const candidates = [];
    if (direction > 0) {
      for (let start = min; start <= max; start++) candidates.push(start);
    } else {
      for (let start = max; start >= min; start--) candidates.push(start);
    }

    const safe = [];
    for (const candidate of candidates) {
      if (!blocked.every(/**
       *
       * @param {number} start
       */
      (start) => Math.abs(candidate - start) >= 4)) { continue; }
      if (!safe.every(/**
       *
       * @param {number} start
       */
      (start) => Math.abs(candidate - start) >= 4)) { continue; }
      safe.push(candidate);
    }

    if (safe.length >= 2) {
      return [safe[0], safe[safe.length - 1]];
    }

    return safe;
  }

  /**
   * @param {Array} safeBands
   */
  #selectCurveBandStarts(safeBands) {
    if (safeBands.length >= 3) {
      const midIndex = Math.floor(safeBands.length / 2);
      return [
        safeBands[0],
        safeBands[midIndex],
        safeBands[safeBands.length - 1],
      ];
    }
    if (safeBands.length >= 2) {
      return [safeBands[0], safeBands[safeBands.length - 1]];
    }
    return safeBands.slice(0, 1);
  }

  /**
   * @param {string} side
   * @param {number} gateCol
   * @param {number} mergeCol
   * @param {number} requestedCount
   */
  #pickCurveTurnCols(side, gateCol, mergeCol, requestedCount) {
    if (side === "LEFT") {
      const width = mergeCol - gateCol;
      const outerNearGate = gateCol + 3;
      const farInland = mergeCol - 3;
      const returnCol = gateCol + Math.max(6, Math.floor(width * 0.42));

      if (
        requestedCount >= 3 &&
        outerNearGate <= farInland - 8 &&
        returnCol >= outerNearGate + 4 &&
        returnCol <= farInland - 4
      ) {
        return [outerNearGate, farInland, returnCol];
      }
      if (requestedCount >= 2) {
        const first = farInland;
        const second = gateCol + Math.max(5, Math.floor(width * 0.38));
        if (first >= second + 4 && second <= mergeCol - 4) {
          return [first, second];
        }
      }
      return outerNearGate <= mergeCol - 4 ? [outerNearGate] : [];
    }

    const width = gateCol - mergeCol;
    const outerNearGate = gateCol - 4;
    const farInland = mergeCol + 2;
    const returnCol = gateCol - Math.max(6, Math.floor(width * 0.42));

    if (
      requestedCount >= 3 &&
      farInland <= outerNearGate - 8 &&
      returnCol <= outerNearGate - 4 &&
      returnCol >= farInland + 4
    ) {
      return [outerNearGate, farInland, returnCol];
    }
    if (requestedCount >= 2) {
      const first = farInland;
      const second = gateCol - Math.max(5, Math.floor(width * 0.38));
      if (first <= second - 4 && second >= mergeCol + 3) {
        return [first, second];
      }
    }
    return outerNearGate >= mergeCol + 3 ? [outerNearGate] : [];
  }

  /**
   * @param {number} [requestedNumPaths]
   * @returns {number}
   */
  selectPathCount(requestedNumPaths) {
    return MapGrid.clamp(
      Number.isFinite(requestedNumPaths)
        ? Math.round(requestedNumPaths)
        : this.#random.rng(DEFAULT_MIN_PATHS, DEFAULT_MAX_PATHS),
      1,
      ENTRY_TEMPLATES.length,
    );
  }
}
