import { MapGrid } from "../MapGrid.js";
import { MAP_TILE_TYPE as TileType } from "../../../enum/MapTileType.js";
import { AbstractMapGenerationStage } from "../AbstractMapGenerationStage.js";

/**
 * Creates the world grid, tile metadata, and island mask from the layout.
 */
export class IslandStage extends AbstractMapGenerationStage {
  /**
   *
   * @type {import("../IslandBuilder.js").IslandBuilder}
   */
  #island;

  /**
   *
   * @param {import("../IslandBuilder.js").IslandBuilder} island
   */
  constructor(island) {
    super();
    /**
     *
     * @type {import("../IslandBuilder.js").IslandBuilder}
     */
    this.#island = island;
  }

  /**
   *
   * @param {import("../GenerationContext.js").GenerationContext} context
   */
  async run(context) {
    const { layout } = context.routing;
    const grid = MapGrid.createGrid(TileType.WATER);
    const tileMeta = MapGrid.createTileMetadata();
    const islandMask = this.#island.buildIslandMask(layout);
    this.#island.materializeIsland(grid, tileMeta, islandMask);

    context.world = { grid, tileMeta, islandMask };
  }
}
