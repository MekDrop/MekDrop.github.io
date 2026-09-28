import { AbstractMapGenerationStage } from "../AbstractMapGenerationStage.js";

/**
 * Creates the world grid, tile metadata, and island mask from the layout.
 */
export class IslandStage extends AbstractMapGenerationStage {
  #operations;

  constructor(operations) {
    super();
    this.#operations = operations;
  }

  async run(context) {
    const { layout } = context.routing;
    const grid = this.#operations.createGrid();
    const tileMeta = this.#operations.createTileMetadata();
    const islandMask = this.#operations.buildIslandMask(layout);
    this.#operations.materializeIsland(grid, tileMeta, islandMask);

    context.world = { grid, tileMeta, islandMask };
  }
}
