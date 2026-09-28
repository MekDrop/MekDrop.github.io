import { IslandBuilder } from "./IslandBuilder.js";
import { TerrainBridgeDipBuilder } from "./TerrainBridgeDipBuilder.js";
import { createEarthTextureVariants } from "../../EarthTextureSelection.js";
import { CastleGenerator } from "../castle/CastleGenerator.js";
import { InvalidOverpassError } from "../../errors/map/index.js";
import { RIVER_KIND } from "../../enum/RiverKind.js";
import { isNumber } from "../../helpers/types.js";
import { SLOPE_DIRECTION } from "../../enum/SlopeDirection.js";
import { TILE_SHAPE } from "../../enum/TileShape.js";
import { GATEWAY_COLORS } from "../../config/gateway.js";
import { GRASS_SURFACE_LIFT } from "../../config/terrain.js";
import { GenerationContext } from "./GenerationContext.js";
import { createMapGenerationPipeline } from "./createMapGenerationPipeline.js";
import { CastleStage } from "./stages/CastleStage.js";
import { CastleBuildPlanStage } from "./stages/CastleBuildPlanStage.js";
import { DecorationStage } from "./stages/DecorationStage.js";
import { FinalizationStage } from "./stages/FinalizationStage.js";
import { IslandStage } from "./stages/IslandStage.js";
import { LayoutStage } from "./stages/LayoutStage.js";
import { PathStage } from "./stages/PathStage.js";
import { RiverStage } from "./stages/RiverStage.js";
import { RouteDataStage } from "./stages/RouteDataStage.js";
import { TerrainStage } from "./stages/TerrainStage.js";
import { ValidationStage } from "./stages/ValidationStage.js";
import {
  YIELD_INTERVAL_MS,
  MAP_COLS,
  MAP_ROWS,
  DEFAULT_MIN_PATHS,
  DEFAULT_MAX_PATHS,
  LEFT_GATE_COL,
  RIGHT_GATE_COL,
  PATH_HEIGHT,
  FOUNDATION_HEIGHT,
  WATER_HEIGHT,
  MAX_RIVERS,
  MIN_RIVER_TILES,
  RIVER_SURFACE_INSET,
  LAVA_SURFACE_INSET,
  RIVER_WATER_DEPTH,
  BRIDGE_WATER_CLEARANCE,
  TERMINAL_WATERFALL_BOTTOM,
  RIVER_COUNT_WEIGHTS,
  LAVA_ISLAND_CHANCE,
  MAX_LAVA_ELIGIBLE_RIVERS,
  CASTLE_REAR_GROUND_CLEARANCE,
  OVERPASS_CHANCE_BY_PATH_COUNT,
  OVERPASS_ELEVATION,
  OVERPASS_RAMP_TILES,
  OVERPASS_HALF_STEP,
  OVERPASS_DECK_THICKNESS,
  OVERPASS_MIN_CLEARANCE,
  OVERPASS_RAISED_ENTRY_CHANCE,
  OVERPASS_STAIR_APPROACH_CHANCE,
  OVERPASS_PLATEAU_RADIUS,
  CASTLE_FOOTPRINTS,
  ENTRY_TEMPLATES,
} from "./mapGenerationConfig.js";
import { MAP_DIRECTION as DIRECTIONS } from "../../enum/MapDirection.js";
import { MAP_TILE_TYPE as TileType } from "../../enum/MapTileType.js";
import { MapGrid } from "./MapGrid.js";
import { GenerationRandom } from "./GenerationRandom.js";
import { PathTopology } from "./PathTopology.js";
import { PathSurfaceRules } from "./PathSurfaceRules.js";
import { RiverPlacementRules } from "./RiverPlacementRules.js";
import { DecorationBuilder } from "./DecorationBuilder.js";

/**
 * @typedef {import("./MapGenerationTypes.js").TileMetadata} TileMetadata
 * @typedef {import("./MapGenerationTypes.js").MapLayout} MapLayout
 * @typedef {import("./MapGenerationTypes.js").LayoutEntry} LayoutEntry
 * @typedef {import("./MapGenerationTypes.js").MapCell} MapCell
 * @typedef {import("./MapGenerationTypes.js").OverpassPlan} OverpassPlan
 * @typedef {import("./MapGenerationTypes.js").RiverRecord} RiverRecord
 * @typedef {import("./MapGenerationTypes.js").RouteRecord} RouteRecord
 * @typedef {import("./MapGenerationTypes.js").GenerationTemplate} GenerationTemplate
 * @typedef {import("./MapGenerationTypes.js").GenerationYieldState} GenerationYieldState
 * @typedef {import("./MapGenerationTypes.js").MapGenerationOptions} MapGenerationOptions
 * @typedef {import("./MapGenerationTypes.js").MapGenerationArgument} MapGenerationArgument
 * @typedef {import("./MapGenerationTypes.js").GridCell} GridCell
 * @typedef {import("./MapGenerationTypes.js").RiverData} RiverData
 * @typedef {import("./MapGenerationTypes.js").RouteData} RouteData
 * @typedef {import("./MapGenerationTypes.js").PathDipPlan} PathDipPlan
 */

export { MAP_TILE_TYPE as TileType } from "../../enum/MapTileType.js";

export class MapGenerator {
  /**
   * @type {IslandBuilder}
   */
  #island = new IslandBuilder();

  /**
   * @type {GenerationRandom}
   */
  #random = new GenerationRandom();
  /**
   * @type {Promise}
   */
  static #generationQueue = Promise.resolve();

  /**
   * @param {MapGenerationOptions} options
   */
  static generate(options) {
    const generator = new MapGenerator();
    const generation = this.#generationQueue.then(() =>
      generator.#generateMap(options),
    );
    this.#generationQueue = generation.catch(() => {});
    return generation;
  }

  /**
   * @param {MapGenerationOptions} options
   */
  async #generateMap(options) {
    const normalizedOptions = this.#normalizeOptions(options);
    const mapName = String(normalizedOptions.mapName ?? this.#createMapName());
    const previousRandom = this.#random;
    this.#random = new GenerationRandom(mapName);

    try {
      const generate = createMapGenerationPipeline({
        /**
         *
         * @param {MapGenerationOptions} pipelineOptions
         */
        createContext: (pipelineOptions) =>
          new GenerationContext(pipelineOptions, {
            now: () => this.#now(),
            /**
             *
             * @param {GenerationYieldState} state
             */
            yieldIfNeeded: (state) => this.#yieldIfNeeded(state),
            yieldToMainThread: () => this.#yieldToMainThread(),
          }),
        createStages: () => this.#createGenerationStages(),
      });
      return await generate({ ...normalizedOptions, mapName });
    } finally {
      this.#random = previousRandom;
    }
  }

  #createGenerationStages() {
    const operations = this.#createStageOperations();
    return [
      new LayoutStage(operations.layout),
      new IslandStage(this.#island),
      new PathStage(operations.path),
      new CastleStage(operations.castle),
      new RiverStage(operations.river),
      new TerrainStage(
        operations.terrain,
        new TerrainBridgeDipBuilder(this.#random),
      ),
      new DecorationStage(new DecorationBuilder(this.#random)),
      new ValidationStage(),
      new RouteDataStage(),
      new CastleBuildPlanStage(operations.castleBuildPlan),
      new FinalizationStage(operations.finalization),
    ];
  }

  #createStageOperations() {
    /**
     *
     * @param {...MapGenerationArgument} args
     */
    const materializeSingleCellTerrainHoles = (...args) =>
      this.#island.materializeSingleCellTerrainHoles(...args);
    /**
     *
     * @param {...MapGenerationArgument} args
     */
    const applyOverpassTerrain = (...args) =>
      this.#applyOverpassTerrain(...args);

    return {
      layout: {
        /**
         *
         * @param {number} requestedNumPaths
         */
        selectPathCount: (requestedNumPaths) =>
          MapGrid.clamp(
            Number.isFinite(requestedNumPaths)
              ? Math.round(requestedNumPaths)
              : this.#random.rng(DEFAULT_MIN_PATHS, DEFAULT_MAX_PATHS),
            1,
            ENTRY_TEMPLATES.length,
          ),
        /**
         *
         * @param {number} numPaths
         */
        createLayoutConfig: (numPaths) => this.#createLayoutConfig(numPaths),
        /**
         *
         * @param {...MapGenerationArgument} args
         */
        selectOverpassPlan: (...args) => this.#selectOverpassPlan(...args),
        /**
         *
         * @param {MapLayout} layout
         */
        retainSeparatedCurvePlans: (layout) =>
          this.#retainSeparatedCurvePlans(layout),
      },
      path: {
        /**
         *
         * @param {...MapGenerationArgument} args
         */
        carvePaths: (...args) => this.#carvePaths(...args),
        /**
         *
         * @param {...MapGenerationArgument} args
         */
        configureOverpassEntryPlateau: (...args) =>
          this.#configureOverpassEntryPlateau(...args),
        materializeSingleCellTerrainHoles,
        /**
         *
         * @param {MapLayout} layout
         * @param {boolean[][]} islandMask
         * @param {number[][]} grid
         */
        assertOverpassFits: (layout, islandMask, grid) => {
          if (
            layout.overpassPlan &&
            !this.#overpassPlanFits(layout.overpassPlan, islandMask, grid)
          ) {
            throw new InvalidOverpassError({
              reason: "does not fit its reserved terrain",
            });
          }
        },
      },
      castle: {
        /**
         *
         * @param {...MapGenerationArgument} args
         */
        placeCastle: (...args) => this.#placeCastle(...args),
        materializeSingleCellTerrainHoles,
      },
      river: {
        /**
         *
         * @param {...MapGenerationArgument} args
         */
        buildHeightmap: (...args) => this.#buildHeightmap(...args),
        applyOverpassTerrain,
        /**
         *
         * @param {...MapGenerationArgument} args
         */
        generateRivers: (...args) => this.#generateRivers(...args),
        /**
         *
         * @param {RiverData[]} riverData
         */
        assignRiverKinds: (riverData) => this.#assignRiverKinds(riverData),
        /**
         *
         * @param {...MapGenerationArgument} args
         */
        raiseLavaSurfaces: (...args) => this.#raiseLavaSurfaces(...args),
      },
      terrain: {
        /**
         *
         * @param {...MapGenerationArgument} args
         */
        smoothGrassHeights: (...args) => this.#smoothGrassHeights(...args),
        applyOverpassTerrain,
        /**
         *
         * @param {...MapGenerationArgument} args
         */
        materializeRiverBanks: (...args) =>
          this.#materializeRiverBanks(...args),
        /**
         *
         * @param {...MapGenerationArgument} args
         */
        materializePathSupports: (...args) =>
          this.#materializePathSupports(...args),
        /**
         *
         * @param {...MapGenerationArgument} args
         */
        applyHeightsToMetadata: (...args) =>
          this.#applyHeightsToMetadata(...args),
        materializeSingleCellTerrainHoles,
      },

      castleBuildPlan: {
        mapDimensions: { cols: MAP_COLS, rows: MAP_ROWS },
        /**
         *
         * @param {MapGenerationOptions} options
         */
        generateCastleBuildPlan: (options) => CastleGenerator.generate(options),
      },
      finalization: {
        mapDimensions: { cols: MAP_COLS, rows: MAP_ROWS },
        gatewayColors: GATEWAY_COLORS,
        grassSurfaceLift: GRASS_SURFACE_LIFT,
        randomUint32: () => Number(this.#random.rng(0, 0xffffffff)) >>> 0,
        createEarthTextureVariants,
      },
    };
  }

  #now() {
    return globalThis.performance?.now?.() ?? Date.now();
  }

  /**
   * @param {GenerationYieldState} state
   */
  async #yieldIfNeeded(state) {
    if (this.#now() - state.lastYield < YIELD_INTERVAL_MS) {
      return;
    }
    await this.#yieldToMainThread();
    state.lastYield = this.#now();
  }

  #yieldToMainThread() {
    return new Promise(/**
     *
     * @param {(value?: void) => void} resolve
     */
    (resolve) => globalThis.setTimeout(resolve, 0));
  }

  #createMapName() {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.floor(Math.random() * 0x100000000)
      .toString(36)
      .padStart(7, "0");
    return `${timestamp}_${randomPart}`;
  }

  /**
   * @param {MapGenerationOptions} options
   */
  #normalizeOptions(options) {
    if (isNumber(options)) {
      return { numPaths: options };
    }
    return options ?? {};
  }

  /**
   * @param {number} numPaths
   */
  #createLayoutConfig(numPaths) {
    const anchorRows = ENTRY_TEMPLATES.map(/**
     *
     * @param {GenerationTemplate} template
     */
    (template) => [
      ...template.gateRows,
    ]);
    const pathRows =
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
    const castleFootprint = CASTLE_FOOTPRINTS[castleFootprintIndex];
    // Keep the castle against the rear of its buildable plateau. The footprint
    // still varies by width and row, while the required grass clearance remains
    // between the back wall and the island edge.
    const castleRight = MAP_COLS - CASTLE_REAR_GROUND_CLEARANCE - 2;
    const castleLeft = castleRight - castleFootprint.width + 1;
    const castleCenterRow = pathRows[1];
    const castleTop = pathRows[0] - Math.floor((castleFootprint.depth - 2) / 2);
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
        this.#rowsOverlap(template.gateRows, castleTop - 3, castleBottom + 3)
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
              castleTop - 3,
              castleBottom + 3,
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
   * @param {boolean|OverpassPlan} requestedOverpass
   */
  #selectOverpassPlan(layout, requestedOverpass) {
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
      const { routeCellsByPath } = this.#carvePaths(
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
   * @param {MapLayout} layout
   */
  #retainSeparatedCurvePlans(layout) {
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
      const { routeCellsByPath } = this.#carvePaths(
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
  #overpassPlanFits(plan, islandMask, grid) {
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
  #configureOverpassEntryPlateau(grid, plan, routeCellsByPath) {
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
   * @param {number[][]} grid
   * @param {TileMetadata[][]} tileMeta
   * @param {number} startCol
   * @param {number} endCol
   * @param {number[]} rows
   * @param {string} direction
   * @param {string} type
   */
  #drawHorizontalPath(
    grid,
    tileMeta,
    startCol,
    endCol,
    rows,
    direction = null,
    type = TileType.PATH,
  ) {
    const left = Math.min(startCol, endCol);
    const right = Math.max(startCol, endCol);
    const horizontalDirection =
      direction ??
      (startCol <= endCol ? DIRECTIONS.EAST : DIRECTIONS.WEST);

    for (const row of rows) {
      MapGrid.fillRect(grid, tileMeta, left, row, right, row, type, {
        surfaceType: type === TileType.ENTRY ? "STRUCTURE" : "PATH",
        baseHeight: PATH_HEIGHT,
        direction: horizontalDirection,
      });
    }
  }

  /**
   * @param {number[][]} grid
   * @param {TileMetadata[][]} tileMeta
   * @param {number} colLeft
   * @param {number} top
   * @param {number} bottom
   */
  #drawVerticalPath(grid, tileMeta, colLeft, top, bottom) {
    const low = Math.min(top, bottom);
    const high = Math.max(top, bottom);
    MapGrid.fillRect(
      grid,
      tileMeta,
      colLeft,
      low,
      colLeft + 1,
      high,
      TileType.PATH,
      {
        surfaceType: "PATH",
        baseHeight: PATH_HEIGHT,
        direction:
          top <= bottom ? DIRECTIONS.SOUTH : DIRECTIONS.NORTH,
      },
    );
  }

  /**
   * @param {number[][]} grid
   * @param {TileMetadata[][]} tileMeta
   * @param {Set<string>} cells
   * @param {number} startCol
   * @param {number} endCol
   * @param {number[]} rows
   * @param {string} direction
   */
  #addHorizontalRoute(
    grid,
    tileMeta,
    cells,
    startCol,
    endCol,
    rows,
    direction = null,
  ) {
    this.#drawHorizontalPath(grid, tileMeta, startCol, endCol, rows, direction);
    const left = Math.min(startCol, endCol);
    const right = Math.max(startCol, endCol);
    for (let col = left; col <= right; col++) {
      for (const row of rows) {
        cells.add(MapGrid.tileKey(col, row));
      }
    }
  }

  /**
   * @param {number[][]} grid
   * @param {TileMetadata[][]} tileMeta
   * @param {Set<string>} cells
   * @param {number} colLeft
   * @param {number} top
   * @param {number} bottom
   */
  #addVerticalRoute(grid, tileMeta, cells, colLeft, top, bottom) {
    this.#drawVerticalPath(grid, tileMeta, colLeft, top, bottom);
    const low = Math.min(top, bottom);
    const high = Math.max(top, bottom);
    for (let row = low; row <= high; row++) {
      cells.add(MapGrid.tileKey(colLeft, row));
      cells.add(MapGrid.tileKey(colLeft + 1, row));
    }
  }

  /**
   * @param {number[][]} grid
   * @param {TileMetadata[][]} tileMeta
   * @param {Set<string>} cells
   * @param {number} colLeft
   * @param {Array} firstRows
   * @param {Array} secondRows
   */
  #addVerticalRouteBetweenBands(
    grid,
    tileMeta,
    cells,
    colLeft,
    firstRows,
    secondRows,
  ) {
    const top = Math.min(firstRows[0], secondRows[0]);
    const bottom = Math.max(firstRows[1], secondRows[1]);
    this.#addVerticalRoute(grid, tileMeta, cells, colLeft, top, bottom);
  }

  /**
   * @param {number[][]} grid
   * @param {TileMetadata[][]} tileMeta
   * @param {MapLayout} layout
   */
  #carvePaths(grid, tileMeta, layout) {
    const mergeZones = new Set();
    const routeCellsByPath = [];
    const trunkStart = Math.min(
      ...layout.entries.map(/**
       *
       * @param {LayoutEntry} entry
       */
      (entry) => entry.mergeCol),
    );

    this.#drawHorizontalPath(
      grid,
      tileMeta,
      trunkStart,
      layout.castleEntranceCol,
      layout.pathRows,
      DIRECTIONS.EAST,
    );

    for (let pathIdx = 0; pathIdx < layout.entries.length; pathIdx++) {
      const entry = layout.entries[pathIdx];
      const [topRow, bottomRow] = entry.gateRows;
      const cells = new Set();

      for (const row of entry.gateRows) {
        MapGrid.setTile(grid, tileMeta, entry.gateCol, row, TileType.ENTRY, {
          surfaceType: "STRUCTURE",
          baseHeight: PATH_HEIGHT,
          direction: entry.inwardDirection,
        });
        cells.add(MapGrid.tileKey(entry.gateCol, row));
      }

      if (entry.curvePlan) {
        const { bands, turnCols } = entry.curvePlan;
        const firstEnd =
          entry.inwardDirection === DIRECTIONS.EAST
            ? turnCols[0] + 1
            : turnCols[0];
        this.#addHorizontalRoute(
          grid,
          tileMeta,
          cells,
          entry.inwardDirection === DIRECTIONS.EAST
            ? entry.gateCol + 1
            : entry.gateCol - 1,
          firstEnd,
          entry.gateRows,
          entry.inwardDirection,
        );
        this.#addVerticalRouteBetweenBands(
          grid,
          tileMeta,
          cells,
          turnCols[0],
          entry.gateRows,
          bands[0],
        );

        for (let index = 0; index < bands.length; index++) {
          const startCol =
            entry.inwardDirection === DIRECTIONS.EAST
              ? turnCols[index]
              : turnCols[index] + 1;
          const endCol =
            index + 1 < turnCols.length
              ? entry.inwardDirection === DIRECTIONS.EAST
                ? turnCols[index + 1] + 1
                : turnCols[index + 1]
              : entry.inwardDirection === DIRECTIONS.EAST
                ? entry.mergeCol + 1
                : entry.mergeCol;
          this.#addHorizontalRoute(
            grid,
            tileMeta,
            cells,
            startCol,
            endCol,
            bands[index],
            entry.inwardDirection,
          );

          if (index + 1 < bands.length) {
            this.#addVerticalRouteBetweenBands(
              grid,
              tileMeta,
              cells,
              turnCols[index + 1],
              bands[index],
              bands[index + 1],
            );
          }
        }

        const finalBand = bands[bands.length - 1];
        if (bottomRow < layout.pathRows[0]) {
          this.#addVerticalRoute(
            grid,
            tileMeta,
            cells,
            entry.mergeCol,
            finalBand[0],
            layout.pathRows[1],
          );
        } else {
          this.#addVerticalRoute(
            grid,
            tileMeta,
            cells,
            entry.mergeCol,
            layout.pathRows[0],
            finalBand[1],
          );
        }
      } else {
        const horizontalStart =
          entry.inwardDirection === DIRECTIONS.EAST
            ? entry.gateCol + 1
            : entry.gateCol - 1;
        const horizontalEnd =
          entry.inwardDirection === DIRECTIONS.EAST
            ? entry.mergeCol + 1
            : entry.mergeCol;
        this.#addHorizontalRoute(
          grid,
          tileMeta,
          cells,
          horizontalStart,
          horizontalEnd,
          entry.gateRows,
          entry.inwardDirection,
        );

        if (bottomRow < layout.pathRows[0]) {
          this.#addVerticalRoute(
            grid,
            tileMeta,
            cells,
            entry.mergeCol,
            topRow,
            layout.pathRows[1],
          );
        } else if (topRow > layout.pathRows[1]) {
          this.#addVerticalRoute(
            grid,
            tileMeta,
            cells,
            entry.mergeCol,
            layout.pathRows[0],
            bottomRow,
          );
        }
      }

      for (let col = entry.mergeCol; col <= entry.mergeCol + 1; col++) {
        for (const row of layout.pathRows) {
          mergeZones.add(MapGrid.tileKey(col, row));
        }
      }

      routeCellsByPath.push({
        pathIdx,
        entry: {
          col: entry.gateCol,
          rows: [...entry.gateRows],
          side: entry.side,
        },
        mergeCol: entry.mergeCol,
        gateRows: [...entry.gateRows],
        routeCells: cells,
      });
    }

    return { mergeZones, routeCellsByPath, trunkStart };
  }

  /**
   * @param {number[][]} grid
   * @param {TileMetadata[][]} tileMeta
   * @param {MapLayout} layout
   */
  #placeCastle(grid, tileMeta, layout) {
    for (let row = layout.castleTop; row <= layout.castleBottom; row++) {
      for (let col = layout.castleLeft; col <= layout.castleRight; col++) {
        const isCorner =
          (row === layout.castleTop || row === layout.castleBottom) &&
          (col === layout.castleLeft || col === layout.castleRight);
        const isEntrance =
          col === layout.castleEntranceCol &&
          layout.castleEntranceRows.includes(row);

        if (isEntrance) {
          MapGrid.setTile(grid, tileMeta, col, row, TileType.PATH, {
            surfaceType: "PATH",
            baseHeight: PATH_HEIGHT,
            direction: DIRECTIONS.EAST,
          });
          continue;
        }

        MapGrid.setTile(
          grid,
          tileMeta,
          col,
          row,
          isCorner ? TileType.CASTLE_TOWER : TileType.CASTLE_WALL,
          {
            surfaceType: "STRUCTURE",
            baseHeight: FOUNDATION_HEIGHT,
          },
        );
      }
    }
  }

  /**
   * @param {number} requestedNumRivers
   */
  #selectRiverCount(requestedNumRivers) {
    if (Number.isFinite(requestedNumRivers)) {
      return MapGrid.clamp(Math.round(requestedNumRivers), 0, MAX_RIVERS);
    }

    const roll = this.#random.rng(1, 100);
    let cumulativeWeight = 0;
    for (let count = 0; count < RIVER_COUNT_WEIGHTS.length; count++) {
      cumulativeWeight += RIVER_COUNT_WEIGHTS[count];
      if (roll <= cumulativeWeight) {
        return count;
      }
    }
    return MAX_RIVERS;
  }

  /**
   * @param {number} col
   * @param {number} row
   * @param {number} centerCol
   * @param {number} centerRow
   * @param {number} radiusX
   * @param {number} radiusY
   */
  #insideEllipse(col, row, centerCol, centerRow, radiusX, radiusY) {
    const dx = (col - centerCol) / radiusX;
    const dy = (row - centerRow) / radiusY;
    return dx * dx + dy * dy <= 1;
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {number} left
   * @param {number} top
   * @param {number} right
   * @param {number} bottom
   * @param {number} value
   * @param {(value: TileMetadata) => boolean} predicate
   */
  #fillHeightRect(
    grid,
    heightmap,
    left,
    top,
    right,
    bottom,
    value,
    predicate = () => true,
  ) {
    for (let row = top; row <= bottom; row++) {
      for (let col = left; col <= right; col++) {
        if (!MapGrid.inBounds(col, row)) { continue; }
        if (heightmap[row][col] === WATER_HEIGHT) { continue; }
        if (!predicate(grid[row][col], col, row)) { continue; }
        heightmap[row][col] = value;
      }
    }
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   */
  #blendGrassNearPaths(grid, heightmap) {
    for (let row = 1; row < MAP_ROWS - 1; row++) {
      for (let col = 1; col < MAP_COLS - 1; col++) {
        if (grid[row][col] !== TileType.GRASS) { continue; }

        let touchesPath = false;
        for (const [dc, dr] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const tile = grid[row + dr][col + dc];
          if (tile === TileType.PATH || tile === TileType.ENTRY) {
            touchesPath = true;
            break;
          }
        }

        if (touchesPath) {
          heightmap[row][col] = PATH_HEIGHT;
        }
      }
    }
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {MapLayout} layout
   */
  #flattenBuildableZones(grid, heightmap, layout) {
    const topPadRight = MapGrid.clamp(layout.castleLeft - 10, 10, 15);
    this.#fillHeightRect(
      grid,
      heightmap,
      6,
      2,
      topPadRight,
      8,
      1,
      /**
       *
       * @param {TileMetadata} tile
       */
      (tile) => tile === TileType.GRASS,
    );
    this.#fillHeightRect(
      grid,
      heightmap,
      6,
      27,
      12,
      33,
      1,
      /**
       *
       * @param {TileMetadata} tile
       */
      (tile) => tile === TileType.GRASS,
    );
    this.#fillHeightRect(
      grid,
      heightmap,
      18,
      23,
      24,
      29,
      2,
      /**
       *
       * @param {TileMetadata} tile
       */
      (tile) => tile === TileType.GRASS,
    );
    this.#fillHeightRect(
      grid,
      heightmap,
      layout.castleLeft - 2,
      layout.castleTop - 1,
      layout.castleRight + CASTLE_REAR_GROUND_CLEARANCE,
      layout.castleBottom + 1,
      FOUNDATION_HEIGHT,
      /**
       *
       * @param {TileMetadata} tile
       */
      (tile) =>
        tile !== TileType.WATER &&
        tile !== TileType.PATH &&
        tile !== TileType.ENTRY,
    );
    this.#fillHeightRect(
      grid,
      heightmap,
      10,
      layout.pathRows[0],
      layout.castleEntranceCol,
      layout.pathRows[1],
      PATH_HEIGHT,
      /**
       *
       * @param {TileMetadata} tile
       */
      (tile) => tile === TileType.PATH || tile === TileType.ENTRY,
    );
  }

  /**
   * @param {number[][]} grid
   * @param {MapLayout} layout
   */
  #buildHeightmap(grid, layout) {
    const heightmap = MapGrid.createGrid(WATER_HEIGHT);

    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const tile = grid[row][col];
        if (tile === TileType.WATER) { continue; }
        if (tile === TileType.PATH || tile === TileType.ENTRY) {
          heightmap[row][col] = PATH_HEIGHT;
          continue;
        }
        if (tile === TileType.CASTLE_WALL || tile === TileType.CASTLE_TOWER) {
          heightmap[row][col] = FOUNDATION_HEIGHT;
          continue;
        }

        let height = 1;
        for (const hill of layout.hillEllipses) {
          if (
            this.#insideEllipse(
              col,
              row,
              hill.centerCol,
              hill.centerRow,
              hill.radiusX,
              hill.radiusY,
            )
          ) {
            height = Math.max(height, hill.height);
          }
        }
        heightmap[row][col] = height;
      }
    }

    this.#smoothGrassHeights(grid, heightmap);
    this.#blendGrassNearPaths(grid, heightmap);
    this.#flattenBuildableZones(grid, heightmap, layout);
    return heightmap;
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {OverpassPlan|PathDipPlan} plan
   */
  #applyOverpassTerrain(grid, heightmap, tileMeta, plan) {
    if (!plan) {
      return;
    }

    for (const cell of plan.raisedTerrainCells ?? []) {
      if (grid[cell.row][cell.col] !== TileType.GRASS) {
        continue;
      }
      heightmap[cell.row][cell.col] = plan.deckElevation;
      tileMeta[cell.row][cell.col] = {
        ...tileMeta[cell.row][cell.col],
        baseHeight: plan.deckElevation,
        overpassPlateauId: plan.id,
      };
    }

    for (const cell of plan.raisedApproachCells ?? []) {
      heightmap[cell.row][cell.col] = plan.deckElevation;
      tileMeta[cell.row][cell.col] = {
        ...tileMeta[cell.row][cell.col],
        baseHeight: plan.deckElevation,
        shape: TILE_SHAPE.FLAT,
        overpassId: plan.id,
      };
    }

    for (const cell of plan.crossingCells) {
      heightmap[cell.row][cell.col] = plan.baseElevation;
      tileMeta[cell.row][cell.col] = {
        ...tileMeta[cell.row][cell.col],
        baseHeight: plan.baseElevation,
        direction: plan.lowerDirection,
        overpassId: plan.id,
        overpass: {
          direction: plan.upperDirection,
          elevation: plan.deckElevation,
        },
      };
    }

    for (const cell of plan.approachCells) {
      heightmap[cell.row][cell.col] = plan.deckElevation;
      tileMeta[cell.row][cell.col] = {
        ...tileMeta[cell.row][cell.col],
        baseHeight: plan.deckElevation,
        shape: TILE_SHAPE.FLAT,
        direction: plan.upperDirection,
        overpassId: plan.id,
      };
    }

    for (const cell of plan.slopeCells) {
      const centerHeight = (cell.lowHeight + cell.highHeight) / 2;
      heightmap[cell.row][cell.col] = centerHeight;
      tileMeta[cell.row][cell.col] = {
        ...tileMeta[cell.row][cell.col],
        baseHeight: centerHeight,
        shape: TILE_SHAPE.SLOPE,
        direction: plan.upperDirection,
        slope: {
          lowHeight: cell.lowHeight,
          highHeight: cell.highHeight,
          riseDirection: cell.riseDirection,
        },
        overpassId: plan.id,
      };
    }

    if (plan.clearance < OVERPASS_MIN_CLEARANCE) {
      throw new InvalidOverpassError({
        reason: `provides only ${plan.clearance} blocks of underside clearance`,
      });
    }
  }

  /**
   * @param {number[][]} grid
   * @param {TileMetadata[][]} tileMeta
   * @param {MapLayout} layout
   * @param {Array} occupiedRiverCells
   * @param {number} col
   * @param {number} row
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
   * @param {RouteRecord} route
   */
  #riverSourceHasEarthEnclosure(grid, route) {
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
   * @param {RouteRecord} route
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
   * @param {Array} parents
   * @param {KeyboardEvent} terminalKey
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
   * @param {Array} occupiedRiverCells
   * @param {GenerationYieldState} yieldState
   */
  async #findRiverRoute(
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
   * @param {RouteRecord} route
   */
  #riverRouteKeepsIslandConnected(grid, route) {
    const trialGrid = grid.map(/**
     *
     * @param {number} row
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
   * @param {RouteRecord} route
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

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {RouteRecord} route
   * @param {string} terminalDirection
   * @param {number} riverIndex
   */
  #materializeRiver(
    grid,
    heightmap,
    tileMeta,
    route,
    terminalDirection,
    riverIndex,
  ) {
    const cells = [];
    const cascades = [];
    let waterElevation = Math.max(
      RIVER_WATER_DEPTH,
      heightmap[route[0].row][route[0].col] - RIVER_SURFACE_INSET,
    );

    for (let index = 0; index < route.length; index++) {
      const cell = route[index];
      const tile = grid[cell.row][cell.col];
      const underBridge = tile === TileType.PATH;
      const terrainHeight = heightmap[cell.row][cell.col];
      const heightLimit = underBridge
        ? PATH_HEIGHT - BRIDGE_WATER_CLEARANCE
        : Math.max(
            RIVER_WATER_DEPTH,
            terrainHeight - RIVER_SURFACE_INSET,
          );
      const previousElevation = waterElevation;
      waterElevation = Math.min(waterElevation, heightLimit);
      const direction =
        index < route.length - 1
          ? MapGrid.directionFromStep(cell, route[index + 1])
          : terminalDirection;

      cells.push({
        ...cell,
        direction,
        elevation: waterElevation,
        bedElevation: Math.max(0, waterElevation - RIVER_WATER_DEPTH),
        terrainHeight,
        underBridge,
      });

      if (index > 0 && previousElevation - waterElevation > 0.04) {
        cascades.push({
          from: { ...route[index - 1] },
          to: { ...cell },
          direction: MapGrid.directionFromStep(route[index - 1], cell),
          topElevation: previousElevation,
          bottomElevation: waterElevation,
        });
      }

      if (!underBridge) {
        MapGrid.setTile(grid, tileMeta, cell.col, cell.row, TileType.WATER, {
          surfaceType: "WATER",
          baseHeight: waterElevation,
          direction,
          riverSourceCover: index === 0,
        });
        heightmap[cell.row][cell.col] = waterElevation;
      }
    }

    const terminal = cells[cells.length - 1];
    return {
      id: `river-${riverIndex + 1}`,
      kind: RIVER_KIND.WATER,
      source: {
        col: cells[0].col,
        row: cells[0].row,
        terrainHeight: cells[0].terrainHeight,
      },
      cells,
      cascades,
      upstreamLength: cells.length - 2,
      waterfall: {
        col: terminal.col,
        row: terminal.row,
        direction: terminalDirection,
        topElevation: terminal.elevation,
        bottomElevation: Math.min(
          TERMINAL_WATERFALL_BOTTOM,
          terminal.elevation - 11.5,
        ),
      },
    };
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {MapLayout} layout
   * @param {boolean[][]} islandMask
   * @param {number} requestedNumRivers
   * @param {GenerationYieldState} yieldState
   */
  async #generateRivers(
    grid,
    heightmap,
    tileMeta,
    layout,
    islandMask,
    requestedNumRivers,
    yieldState,
  ) {
    const riverCount = this.#selectRiverCount(requestedNumRivers);
    if (riverCount === 0) {
      return [];
    }

    const sourceCandidates = [];
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (
          grid[row][col] === TileType.GRASS &&
          !tileMeta[row][col].overpassPlateauId &&
          heightmap[row][col] >= 2 &&
          RiverPlacementRules.hasRiverSourceSetback(islandMask, col, row) &&
          !RiverPlacementRules.isNearCastleForRiver(layout, col, row)
        ) {
          sourceCandidates.push({ col, row, height: heightmap[row][col] });
        }
      }
    }
    this.#random.shuffle(sourceCandidates);
    sourceCandidates.sort(/**
     *
     * @param {{height: number}} left
     * @param {{height: number}} right
     */
    (left, right) => right.height - left.height);

    const rivers = [];
    const occupiedRiverCells = new Set();
    for (const source of sourceCandidates) {
      await this.#yieldIfNeeded(yieldState);
      if (rivers.length >= riverCount) {
        break;
      }
      if (
        RiverPlacementRules.touchesOccupiedRiver(occupiedRiverCells, source.col, source.row)
      ) {
        continue;
      }
      const result = await this.#findRiverRoute(
        grid,
        tileMeta,
        islandMask,
        layout,
        source,
        occupiedRiverCells,
        yieldState,
      );
      if (!result) {
        continue;
      }
      if (!this.#riverSourceHasEarthEnclosure(grid, result.route)) {
        continue;
      }
      const river = this.#materializeRiver(
        grid,
        heightmap,
        tileMeta,
        result.route,
        result.terminalDirection,
        rivers.length,
      );
      rivers.push(river);
      for (const cell of result.route) {
        occupiedRiverCells.add(MapGrid.tileKey(cell.col, cell.row));
      }
    }
    return rivers;
  }

  /**
   * @param {Array} rivers
   */
  #assignRiverKinds(rivers) {
    if (
      rivers.length === 0 ||
      rivers.length > MAX_LAVA_ELIGIBLE_RIVERS ||
      this.#random.rng(1, LAVA_ISLAND_CHANCE) !== 1
    ) {
      return;
    }

    const lavaRiverCount = this.#random.rng(
      1,
      Math.min(MAX_LAVA_ELIGIBLE_RIVERS, rivers.length),
    );
    for (const river of this.#random.shuffle([...rivers]).slice(0, lavaRiverCount)) {
      river.kind = RIVER_KIND.LAVA;
    }
  }

  /**
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {Array} rivers
   */
  #raiseLavaSurfaces(heightmap, tileMeta, rivers) {
    for (const river of rivers) {
      if (river.kind !== RIVER_KIND.LAVA) {
        continue;
      }

      let previousElevation = Number.POSITIVE_INFINITY;
      const cascades = [];
      for (const [index, cell] of river.cells.entries()) {
        const heightLimit = cell.underBridge
          ? PATH_HEIGHT - BRIDGE_WATER_CLEARANCE
          : Math.max(
              RIVER_WATER_DEPTH,
              cell.terrainHeight - LAVA_SURFACE_INSET,
            );
        const elevation = Math.min(previousElevation, heightLimit);
        cell.elevation = elevation;
        cell.bedElevation = Math.max(0, elevation - RIVER_WATER_DEPTH);

        if (!cell.underBridge) {
          heightmap[cell.row][cell.col] = elevation;
          tileMeta[cell.row][cell.col].baseHeight = elevation;
          tileMeta[cell.row][cell.col].riverSourceCover = index === 0;
        }

        if (index > 0 && previousElevation - elevation > 0.04) {
          const previous = river.cells[index - 1];
          cascades.push({
            from: { col: previous.col, row: previous.row },
            to: { col: cell.col, row: cell.row },
            direction: MapGrid.directionFromStep(previous, cell),
            topElevation: previousElevation,
            bottomElevation: elevation,
          });
        }
        previousElevation = elevation;
      }

      river.cascades = cascades;
      river.waterfall.topElevation = river.cells.at(-1).elevation;
    }
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {boolean[][]} islandMask
   * @param {RiverData[]} riverData
   */
  #materializeRiverBanks(
    grid,
    heightmap,
    tileMeta,
    islandMask,
    riverData,
  ) {
    const directionOffsets = {
      [DIRECTIONS.NORTH]: [0, -1],
      [DIRECTIONS.EAST]: [1, 0],
      [DIRECTIONS.SOUTH]: [0, 1],
      [DIRECTIONS.WEST]: [-1, 0],
    };
    const riverCellKeys = new Set(
      riverData.flatMap(/**
       *
       * @param {RiverRecord} river
       */
      (river) =>
        river.cells.map(/**
         *
         * @param {MapCell} cell
         */
        (cell) => MapGrid.tileKey(cell.col, cell.row)),
      ),
    );

    for (const river of riverData) {
      for (const cell of river.cells) {
        if (cell.underBridge) {
          continue;
        }
        const [deltaCol, deltaRow] = directionOffsets[cell.direction] ?? [0, 0];
        const crossCol = -deltaRow;
        const crossRow = deltaCol;
        const bankHeight = Math.ceil(
          cell.elevation + RiverPlacementRules.riverSurfaceInset(river),
        );

        for (const side of [-1, 1]) {
          const col = cell.col + crossCol * side;
          const row = cell.row + crossRow * side;
          const key = MapGrid.tileKey(col, row);
          if (
            !MapGrid.inBounds(col, row) ||
            riverCellKeys.has(key) ||
            (grid[row][col] !== TileType.GRASS &&
              grid[row][col] !== TileType.WATER)
          ) {
            continue;
          }
          if (grid[row][col] === TileType.WATER) {
            MapGrid.setTile(grid, tileMeta, col, row, TileType.GRASS, {
              surfaceType: "GRASS",
              baseHeight: bankHeight,
              shape: TILE_SHAPE.FLAT,
              direction: DIRECTIONS.NONE,
            });
          }
          islandMask[row][col] = true;
          heightmap[row][col] = Math.max(heightmap[row][col], bankHeight);
        }
      }

      const terminal = river.cells.at(-1);
      const [waterfallCol, waterfallRow] = directionOffsets[
        river.waterfall.direction
      ] ?? [0, 0];
      const waterfallCrossCol = -waterfallRow;
      const waterfallCrossRow = waterfallCol;
      const waterfallBankHeight = Math.ceil(
        terminal.elevation + RiverPlacementRules.riverSurfaceInset(river),
      );
      for (const side of [-1, 1]) {
        const col = terminal.col + waterfallCol + waterfallCrossCol * side;
        const row = terminal.row + waterfallRow + waterfallCrossRow * side;
        const key = MapGrid.tileKey(col, row);
        if (
          !MapGrid.inBounds(col, row) ||
          riverCellKeys.has(key) ||
          (grid[row][col] !== TileType.GRASS &&
            grid[row][col] !== TileType.WATER)
        ) {
          continue;
        }
        if (grid[row][col] === TileType.WATER) {
          MapGrid.setTile(grid, tileMeta, col, row, TileType.GRASS, {
            surfaceType: "GRASS",
            baseHeight: waterfallBankHeight,
            shape: TILE_SHAPE.FLAT,
            direction: DIRECTIONS.NONE,
          });
        }
        islandMask[row][col] = true;
        heightmap[row][col] = Math.max(
          heightmap[row][col],
          waterfallBankHeight,
        );
      }

      const source = river.cells[0];
      const sourceBankHeight = Math.ceil(
        source.elevation + RiverPlacementRules.riverSurfaceInset(river),
      );
      for (let deltaRow = -1; deltaRow <= 1; deltaRow++) {
        for (let deltaCol = -1; deltaCol <= 1; deltaCol++) {
          if (deltaCol === 0 && deltaRow === 0) {
            continue;
          }
          const bankCol = source.col + deltaCol;
          const bankRow = source.row + deltaRow;
          const bankKey = MapGrid.tileKey(bankCol, bankRow);
          if (
            !MapGrid.inBounds(bankCol, bankRow) ||
            riverCellKeys.has(bankKey) ||
            (grid[bankRow][bankCol] !== TileType.GRASS &&
              grid[bankRow][bankCol] !== TileType.WATER)
          ) {
            continue;
          }
          if (grid[bankRow][bankCol] === TileType.WATER) {
            MapGrid.setTile(grid, tileMeta, bankCol, bankRow, TileType.GRASS, {
              surfaceType: "GRASS",
              baseHeight: sourceBankHeight,
              shape: TILE_SHAPE.FLAT,
              direction: DIRECTIONS.NONE,
            });
          }
          islandMask[bankRow][bankCol] = true;
          heightmap[bankRow][bankCol] = Math.max(
            heightmap[bankRow][bankCol],
            sourceBankHeight,
          );
        }
      }

      for (const cascade of river.cascades) {
        const [deltaCol, deltaRow] = directionOffsets[cascade.direction] ?? [
          0, 0,
        ];
        const crossCol = -deltaRow;
        const crossRow = deltaCol;
        const bankHeight = Math.ceil(cascade.topElevation);
        for (const anchor of [cascade.from, cascade.to]) {
          for (const side of [-1, 1]) {
            const col = anchor.col + crossCol * side;
            const row = anchor.row + crossRow * side;
            if (
              !MapGrid.inBounds(col, row) ||
              grid[row][col] !== TileType.GRASS
            ) {
              continue;
            }
            heightmap[row][col] = Math.max(heightmap[row][col], bankHeight);
          }
        }
      }
    }
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   */
  #smoothGrassHeights(grid, heightmap) {
    let changed = true;

    while (changed) {
      changed = false;
      for (let row = 1; row < MAP_ROWS - 1; row++) {
        for (let col = 1; col < MAP_COLS - 1; col++) {
          if (grid[row][col] !== TileType.GRASS) { continue; }
          if (heightmap[row][col] <= 1) { continue; }

          let similarNeighbors = 0;
          for (const [dc, dr] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            if (
              grid[row + dr][col + dc] === TileType.GRASS &&
              heightmap[row + dr][col + dc] === heightmap[row][col]
            ) {
              similarNeighbors++;
            }
          }

          if (similarNeighbors === 0) {
            heightmap[row][col] -= 1;
            changed = true;
          }
        }
      }
    }
  }

  /**
   * @param {number[][]} grid
   * @param {TileMetadata[][]} tileMeta
   * @param {number[][]} heightmap
   * @param {RiverData[]} riverData
   */
  #applyHeightsToMetadata(grid, tileMeta, heightmap, riverData) {
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        tileMeta[row][col] = {
          ...tileMeta[row][col],
          baseHeight: heightmap[row][col],
          renderMode: "SOLID",
        };

        const tile = grid[row][col];
        if (tile === TileType.CASTLE_WALL || tile === TileType.CASTLE_TOWER) {
          tileMeta[row][col].surfaceType = "STRUCTURE";
        } else if (tile === TileType.PATH) {
          tileMeta[row][col].surfaceType = "PATH";
        } else if (tile === TileType.ENTRY) {
          tileMeta[row][col].surfaceType = "STRUCTURE";
        } else if (tile === TileType.GRASS) {
          tileMeta[row][col].surfaceType = "GRASS";
        }
      }
    }

    this.#applyPathRenderModes(grid, heightmap, tileMeta);
    this.#assignBridgeGround(tileMeta, heightmap, riverData);
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   * @param {RiverData[]} riverData
   */
  #materializePathSupports(grid, heightmap, tileMeta, riverData) {
    const riverCells = new Set(
      riverData.flatMap(/**
       *
       * @param {RiverRecord} river
       */
      (river) =>
        river.cells.map(/**
         *
         * @param {MapCell} cell
         */
        (cell) => MapGrid.tileKey(cell.col, cell.row)),
      ),
    );
    const processedStations = new Set();
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (grid[row][col] !== TileType.PATH) {
          continue;
        }
        if (tileMeta[row][col].shape === TILE_SHAPE.SLOPE) {
          continue;
        }
        if (tileMeta[row][col].overpassId) {
          continue;
        }
        const lateralCells = PathSurfaceRules.pathLateralCells(grid, tileMeta, col, row);
        if (!lateralCells) {
          continue;
        }
        const direction = tileMeta[row][col].direction;
        const axis =
          direction === DIRECTIONS.EAST ||
          direction === DIRECTIONS.WEST
            ? "H"
            : "V";
        const stationKey = `${axis}:${lateralCells
          .map(/**
           *
           * @param {MapCell} cell
           */
          (cell) => MapGrid.tileKey(cell.col, cell.row))
          .sort()
          .join("|")}`;
        if (processedStations.has(stationKey)) {
          continue;
        }
        processedStations.add(stationKey);

        const pathHeight = heightmap[row][col];
        const supportedSides = lateralCells.filter(
          /**
           *
           * @param {{col: number, row: number}} options
           * @param {number} options.col
           * @param {number} options.row
           */
          ({ col: sideCol, row: sideRow }) =>
            PathSurfaceRules.hasPathSideBlock(
              grid,
              heightmap,
              sideCol,
              sideRow,
              pathHeight,
            ),
        );
        if (
          supportedSides.length !== 1 &&
          !PathSurfaceRules.isPathTurnPosition(grid, lateralCells)
        ) {
          continue;
        }

        for (const { col: sideCol, row: sideRow } of lateralCells) {
          if (
            PathSurfaceRules.hasPathSideBlock(
              grid,
              heightmap,
              sideCol,
              sideRow,
              pathHeight,
            ) ||
            !MapGrid.inBounds(sideCol, sideRow) ||
            riverCells.has(MapGrid.tileKey(sideCol, sideRow))
          ) {
            continue;
          }
          MapGrid.setTile(grid, tileMeta, sideCol, sideRow, TileType.GRASS, {
            surfaceType: "GRASS",
            baseHeight: pathHeight,
          });
          heightmap[sideRow][sideCol] = pathHeight;
        }
      }
    }
  }

  /**
   * @param {number[][]} grid
   * @param {number[][]} heightmap
   * @param {TileMetadata[][]} tileMeta
   */
  #applyPathRenderModes(grid, heightmap, tileMeta) {
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (grid[row][col] !== TileType.PATH) {
          continue;
        }
        tileMeta[row][col].renderMode = PathSurfaceRules.classifyRenderMode(
          grid,
          heightmap,
          tileMeta,
          col,
          row,
        );
      }
    }
  }

  /**
   * @param {TileMetadata[][]} tileMeta
   * @param {number[][]} heightmap
   * @param {RiverData[]} riverData
   */
  #assignBridgeGround(tileMeta, heightmap, riverData) {
    const riverBridgeCells = new Set(
      riverData.flatMap(/**
       *
       * @param {RiverRecord} river
       */
      (river) =>
        river.cells
          .filter(/**
           *
           * @param {MapCell} cell
           */
          (cell) => cell.underBridge)
          .map(/**
           *
           * @param {MapCell} cell
           */
          (cell) => MapGrid.tileKey(cell.col, cell.row)),
      ),
    );
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (tileMeta[row][col].renderMode !== "BRIDGE") {
          continue;
        }
        tileMeta[row][col].bridgeGroundHeight = riverBridgeCells.has(
          MapGrid.tileKey(col, row),
        )
          ? null
          : Math.max(1, heightmap[row][col] - 1);
      }
    }
  }

}

/**
 *
 * @param {MapGenerationOptions} options
 */
export function generateMap(options) {
  return MapGenerator.generate(options);
}
