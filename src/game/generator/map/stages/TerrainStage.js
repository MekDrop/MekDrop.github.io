import { AbstractMapGenerationStage } from "../AbstractMapGenerationStage.js";

/**
 * Resolves terrain smoothing, banks, supports, dips, and tile elevations.
 */
export class TerrainStage extends AbstractMapGenerationStage {
  /**
   * @type {import("../TerrainBuilder.js").TerrainBuilder}
   */
  #terrain;

  /**
   * @type {import("../RiverBuilder.js").RiverBuilder}
   */
  #rivers;

  /**
   * @type {import("../TerrainBridgeDipBuilder.js").TerrainBridgeDipBuilder}
   */
  #dips;

  /**
   * @type {import("../IslandBuilder.js").IslandBuilder}
   */
  #island;

  /**
   * @param {import("../TerrainBuilder.js").TerrainBuilder} terrain
   * @param {import("../RiverBuilder.js").RiverBuilder} rivers
   * @param {import("../TerrainBridgeDipBuilder.js").TerrainBridgeDipBuilder} dips
   * @param {import("../IslandBuilder.js").IslandBuilder} island
   */
  constructor(terrain, rivers, dips, island) {
    super();
    this.#terrain = terrain;
    this.#rivers = rivers;
    this.#dips = dips;
    this.#island = island;
  }

  /**
   * @param {import("../GenerationContext.js").GenerationContext} context
   */
  async run(context) {
    const { grid, heightmap, tileMeta, islandMask } = context.world;
    const { layout, mergeZones } = context.routing;
    const { riverData } = context.features;
    this.#terrain.smoothGrassHeights(grid, heightmap);
    this.#terrain.applyOverpassTerrain(
      grid,
      heightmap,
      tileMeta,
      layout.overpassPlan,
    );
    this.#rivers.materializeRiverBanks(
      grid,
      heightmap,
      tileMeta,
      islandMask,
      riverData,
    );
    this.#terrain.materializePathSupports(
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
    this.#terrain.applyHeightsToMetadata(
      grid,
      tileMeta,
      heightmap,
      riverData,
    );
    this.#island.materializeSingleCellTerrainHoles(
      grid,
      tileMeta,
      islandMask,
      heightmap,
    );
  }
}
