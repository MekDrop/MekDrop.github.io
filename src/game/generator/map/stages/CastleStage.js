import { AbstractMapGenerationStage } from "../AbstractMapGenerationStage.js";

/**
 * Places the castle footprint into the routed island world.
 */
export class CastleStage extends AbstractMapGenerationStage {
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
    const { layout } = context.routing;
    this.#operations.placeCastle(grid, tileMeta, layout);
    this.#operations.materializeSingleCellTerrainHoles(
      grid,
      tileMeta,
      islandMask,
    );
  }
}
