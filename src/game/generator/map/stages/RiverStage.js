import { AbstractMapGenerationStage } from "../AbstractMapGenerationStage.js";

/**
 * Builds terrain heights and materializes deterministic river features.
 */
export class RiverStage extends AbstractMapGenerationStage {
  /**
   * @type {import("../TerrainBuilder.js").TerrainBuilder}
   */
  #terrain;

  /**
   * @type {import("../RiverBuilder.js").RiverBuilder}
   */
  #rivers;

  /**
   * @param {import("../TerrainBuilder.js").TerrainBuilder} terrain
   * @param {import("../RiverBuilder.js").RiverBuilder} rivers
   */
  constructor(terrain, rivers) {
    super();
    this.#terrain = terrain;
    this.#rivers = rivers;
  }

  /**
   * @param {import("../GenerationContext.js").GenerationContext} context
   */
  async run(context) {
    const { grid, tileMeta, islandMask } = context.world;
    const { layout, requestedNumRivers } = context.routing;
    const heightmap = this.#terrain.buildHeightmap(grid, layout);
    this.#terrain.applyOverpassTerrain(
      grid,
      heightmap,
      tileMeta,
      layout.overpassPlan,
    );
    await context.scheduler.yieldIfNeeded(context.yieldState);
    const riverData = await this.#rivers.generateRivers(
      grid,
      heightmap,
      tileMeta,
      layout,
      islandMask,
      requestedNumRivers,
      context.yieldState,
    );
    this.#rivers.assignRiverKinds(riverData);
    this.#rivers.raiseLavaSurfaces(heightmap, tileMeta, riverData);

    context.world.heightmap = heightmap;
    context.features.riverData = riverData;
  }
}
