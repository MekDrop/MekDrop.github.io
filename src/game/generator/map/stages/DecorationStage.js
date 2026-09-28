import { DecorationBuilder } from "../DecorationBuilder.js";
import { AbstractMapGenerationStage } from "../AbstractMapGenerationStage.js";

/**
 * Places vegetation, stones, ground cover, and cliff vines on final terrain.
 */
export class DecorationStage extends AbstractMapGenerationStage {
  /**
   *
   * @type {DecorationBuilder}
   */
  #builder;

  /**
   *
   * @param {DecorationBuilder} builder
   */
  constructor(builder) {
    super();
    /**
     *
     * @type {DecorationBuilder}
     */
    this.#builder = builder;
  }

  /**
   *
   * @param {import("../GenerationContext.js").GenerationContext} context
   */
  async run(context) {
    const { grid, heightmap, tileMeta, islandMask } = context.world;
    const { layout } = context.routing;
    const { riverData } = context.features;
    const vegetationPlacements = this.#builder.placeVegetation(
      grid,
      heightmap,
      tileMeta,
      layout,
    );
    await context.scheduler.yieldIfNeeded(context.yieldState);
    const stonePlacements = this.#builder.placeStones(
      grid,
      heightmap,
      tileMeta,
      vegetationPlacements,
      context.input.mapName,
    );
    await context.scheduler.yieldIfNeeded(context.yieldState);
    const groundCoverData = this.#builder.placeGroundCover(
      grid,
      heightmap,
      tileMeta,
      vegetationPlacements,
      stonePlacements,
    );
    await context.scheduler.yieldIfNeeded(context.yieldState);
    const cliffVineData = this.#builder.placeCliffVines(
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
