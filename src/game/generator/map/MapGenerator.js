import { TerrainBuilder } from "./TerrainBuilder.js";
import { RiverRouter } from "./RiverRouter.js";
import { RiverBuilder } from "./RiverBuilder.js";
import { LayoutPlanner } from "./LayoutPlanner.js";
import { OverpassPlanner } from "./OverpassPlanner.js";
import { PathCarver } from "./PathCarver.js";
import { CastlePlacement } from "./CastlePlacement.js";
import { IslandBuilder } from "./IslandBuilder.js";
import { IslandConnectorBuilder } from "./IslandConnectorBuilder.js";
import { TerrainBridgeDipBuilder } from "./TerrainBridgeDipBuilder.js";
import { createEarthTextureVariants } from "../../EarthTextureSelection.js";
import { CastleGenerator } from "../castle/CastleGenerator.js";
import * as MapErrors from "../../errors/map/index.js";
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

const MAX_RANDOM_MAP_ATTEMPTS = 5;
const RETRYABLE_MAP_ERRORS = Object.values(MapErrors).filter(
  /**
   * @param {typeof Error} ErrorType
   */
  (ErrorType) =>
    ErrorType !== MapErrors.MapGenerationStageRunNotImplementedError &&
    ErrorType !== MapErrors.StoredMapNotFoundError,
);

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
    const generation = this.#generationQueue.then(async () => {
      const normalizedOptions = generator.#normalizeOptions(options);
      const attempts = normalizedOptions.mapName == null
        ? MAX_RANDOM_MAP_ATTEMPTS
        : 1;
      let attempt = 0;
      while (true) {
        try {
          return await generator.#generateMap(normalizedOptions);
        } catch (error) {
          attempt += 1;
          if (
            attempt >= attempts ||
            !RETRYABLE_MAP_ERRORS.some(
              /**
               * @param {typeof Error} ErrorType
               */
              (ErrorType) => error instanceof ErrorType,
            )
          ) {
            throw error;
          }
        }
      }
    });
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
    /**
     * @param {GenerationYieldState} state
     */
    const yieldIfNeeded = (state) => this.#yieldIfNeeded(state);
    const terrain = new TerrainBuilder();
    const rivers = new RiverBuilder(
      this.#random,
      new RiverRouter(this.#random, yieldIfNeeded),
      yieldIfNeeded,
    );
    const paths = new PathCarver();
    const overpasses = new OverpassPlanner(this.#random, paths);
    return [
      new LayoutStage(new LayoutPlanner(this.#random, paths), overpasses),
      new IslandStage(this.#island),
      new PathStage(paths, overpasses, this.#island),
      new CastleStage(new CastlePlacement(), this.#island),
      new RiverStage(terrain, rivers),
      new TerrainStage(
        terrain,
        rivers,
        new TerrainBridgeDipBuilder(this.#random),
        this.#island,
        new IslandConnectorBuilder(),
        this.#random,
      ),
      new DecorationStage(new DecorationBuilder(this.#random)),
      new ValidationStage(),
      new RouteDataStage(),
      new CastleBuildPlanStage({
        mapDimensions: { cols: MAP_COLS, rows: MAP_ROWS },
        generateCastleBuildPlan: CastleGenerator.generate.bind(CastleGenerator),
      }),
      new FinalizationStage({
        mapDimensions: { cols: MAP_COLS, rows: MAP_ROWS },
        gatewayColors: GATEWAY_COLORS,
        grassSurfaceLift: GRASS_SURFACE_LIFT,
        randomUint32: () => Number(this.#random.rng(0, 0xffffffff)) >>> 0,
        createEarthTextureVariants,
      }),
    ];
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

}

/**
 *
 * @param {MapGenerationOptions} options
 */
export function generateMap(options) {
  return MapGenerator.generate(options);
}
