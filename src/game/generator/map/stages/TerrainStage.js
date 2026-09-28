import { AbstractMapGenerationStage } from "../AbstractMapGenerationStage.js";

/**
 * @typedef {import("../MapGenerationTypes.js").TileMetadata} TileMetadata
 * @typedef {import("../MapGenerationTypes.js").RiverData} RiverData
 * @typedef {import("../MapGenerationTypes.js").OverpassPlan} OverpassPlan
 */

/**
 * Terrain operations still implemented by the facade, excluding dip construction.
 * @typedef {object} TerrainOperations
 * @property {(grid: number[][], heightmap: number[][]) => void} smoothGrassHeights
 * @property {(grid: number[][], heightmap: number[][], tileMeta: TileMetadata[][], plan: OverpassPlan|null) => void} applyOverpassTerrain
 * @property {(grid: number[][], heightmap: number[][], tileMeta: TileMetadata[][], islandMask: boolean[][], rivers: RiverData[]) => void} materializeRiverBanks
 * @property {(grid: number[][], heightmap: number[][], tileMeta: TileMetadata[][], rivers: RiverData[]) => void} materializePathSupports
 * @property {(grid: number[][], tileMeta: TileMetadata[][], heightmap: number[][], rivers: RiverData[]) => void} applyHeightsToMetadata
 * @property {(grid: number[][], tileMeta: TileMetadata[][], islandMask: boolean[][], heightmap: number[][]) => void} materializeSingleCellTerrainHoles
 */

/**
 * Resolves terrain smoothing, banks, supports, dips, and tile elevations.
 */
export class TerrainStage extends AbstractMapGenerationStage {
  /**
   *
   * @type {TerrainOperations}
   */
  #operations;

  /**
   * @type {import("../TerrainBridgeDipBuilder.js").TerrainBridgeDipBuilder}
   */
  #dips;

  /**
   *
   * @param {TerrainOperations} operations
   * @param {import("../TerrainBridgeDipBuilder.js").TerrainBridgeDipBuilder} dips
   */
  constructor(operations, dips) {
    super();
    this.#operations = operations;
    this.#dips = dips;
  }

  /**
   *
   * @param {import("../GenerationContext.js").GenerationContext} context
   */
  async run(context) {
    const { grid, heightmap, tileMeta, islandMask } = context.world;
    const { layout, mergeZones } = context.routing;
    const { riverData } = context.features;
    this.#operations.smoothGrassHeights(grid, heightmap);
    this.#operations.applyOverpassTerrain(
      grid,
      heightmap,
      tileMeta,
      layout.overpassPlan,
    );
    this.#operations.materializeRiverBanks(
      grid,
      heightmap,
      tileMeta,
      islandMask,
      riverData,
    );
    this.#operations.materializePathSupports(
      grid,
      heightmap,
      tileMeta,
      riverData,
    );
    await context.scheduler.yieldIfNeeded(context.yieldState);
    layout.pathDipPlans = this.#dips.applyTerrainBridgeDips(
      grid,
      heightmap,
      tileMeta,
      riverData,
      mergeZones,
    );
    this.#operations.applyHeightsToMetadata(
      grid,
      tileMeta,
      heightmap,
      riverData,
    );
    this.#operations.materializeSingleCellTerrainHoles(
      grid,
      tileMeta,
      islandMask,
      heightmap,
    );
  }
}
