import { AbstractMapGenerationStage } from "../AbstractMapGenerationStage.js";

/**
 * Places the castle footprint into the routed island world.
 */
export class CastleStage extends AbstractMapGenerationStage {
  #operations;

  constructor(operations) {
    super();
    this.#operations = operations;
  }

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
