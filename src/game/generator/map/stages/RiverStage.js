import { AbstractMapGenerationStage } from "../AbstractMapGenerationStage.js";

/**
 * Builds terrain heights and materializes deterministic river features.
 */
export class RiverStage extends AbstractMapGenerationStage {
  /**
   *
   * @type {Array}
   */
  #operations;

  /**
   *
   * @param {Array<() => void>} operations
   */
  constructor(operations) {
    super();
    /**
     *
     * @type {Array}
     */
    this.#operations = operations;
  }

  /**
   *
   * @param {GenerationContext} context
   */
  async run(context) {
    const { grid, tileMeta, islandMask } = context.world;
    const { layout, requestedNumRivers } = context.routing;
    const heightmap = this.#operations.buildHeightmap(grid, layout);
    this.#operations.applyOverpassTerrain(
      grid,
      heightmap,
      tileMeta,
      layout.overpassPlan,
    );
    await context.scheduler.yieldIfNeeded(context.yieldState);
    const riverData = await this.#operations.generateRivers(
      grid,
      heightmap,
      tileMeta,
      layout,
      islandMask,
      requestedNumRivers,
      context.yieldState,
    );
    this.#operations.assignRiverKinds(riverData);
    this.#operations.raiseLavaSurfaces(heightmap, tileMeta, riverData);

    context.world.heightmap = heightmap;
    context.features.riverData = riverData;
  }
}
