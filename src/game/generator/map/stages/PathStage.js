import { AbstractMapGenerationStage } from "../AbstractMapGenerationStage.js";

/**
 * Carves routes and records merge, trunk, and per-path routing artifacts.
 */
export class PathStage extends AbstractMapGenerationStage {
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
    const { mergeZones, routeCellsByPath, trunkStart } =
      this.#operations.carvePaths(grid, tileMeta, layout);
    this.#operations.configureOverpassEntryPlateau(
      grid,
      layout.overpassPlan,
      routeCellsByPath,
    );
    this.#operations.materializeSingleCellTerrainHoles(
      grid,
      tileMeta,
      islandMask,
    );
    this.#operations.assertOverpassFits(layout, islandMask, grid);

    Object.assign(context.routing, {
      mergeZones,
      routeCellsByPath,
      trunkStart,
    });
  }
}
