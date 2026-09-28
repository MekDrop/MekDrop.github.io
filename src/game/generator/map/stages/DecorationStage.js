import { AbstractMapGenerationStage } from "../AbstractMapGenerationStage.js";

/**
 * Places vegetation, stones, ground cover, and cliff vines on final terrain.
 */
export class DecorationStage extends AbstractMapGenerationStage {
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
    const { grid, heightmap, tileMeta, islandMask } = context.world;
    const { layout } = context.routing;
    const { riverData } = context.features;
    const vegetationPlacements = this.#operations.placeVegetation(
      grid,
      heightmap,
      tileMeta,
      layout,
    );
    await context.scheduler.yieldIfNeeded(context.yieldState);
    const stonePlacements = this.#operations.placeStones(
      grid,
      heightmap,
      tileMeta,
      vegetationPlacements,
      context.input.mapName,
    );
    await context.scheduler.yieldIfNeeded(context.yieldState);
    const groundCoverData = this.#operations.placeGroundCover(
      grid,
      heightmap,
      tileMeta,
      vegetationPlacements,
      stonePlacements,
    );
    await context.scheduler.yieldIfNeeded(context.yieldState);
    const cliffVineData = this.#operations.placeCliffVines(
      grid,
      heightmap,
      islandMask,
      riverData,
    );

    Object.assign(context.features, {
      vegetationPlacements,
      stonePlacements,
      groundCoverData,
      cliffVineData,
    });
  }
}
