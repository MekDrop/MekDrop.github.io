import { AbstractMapGenerationStage } from "../AbstractMapGenerationStage.js";

/**
 * Places the castle footprint into the routed island world.
 */
export class CastleStage extends AbstractMapGenerationStage {
  /**
   * @type {import("../CastlePlacement.js").CastlePlacement}
   */
  #castle;

  /**
   * @type {import("../IslandBuilder.js").IslandBuilder}
   */
  #island;

  /**
   * @param {import("../CastlePlacement.js").CastlePlacement} castle
   * @param {import("../IslandBuilder.js").IslandBuilder} island
   */
  constructor(castle, island) {
    super();
    this.#castle = castle;
    this.#island = island;
  }

  /**
   * @param {import("../GenerationContext.js").GenerationContext} context
   */
  async run(context) {
    const { grid, tileMeta, islandMask } = context.world;
    const { layout } = context.routing;
    this.#castle.placeCastle(grid, tileMeta, layout);
    this.#island.materializeSingleCellTerrainHoles(
      grid,
      tileMeta,
      islandMask,
    );
  }
}
