import { InvalidOverpassError } from "../../../errors/map/index.js";
import { AbstractMapGenerationStage } from "../AbstractMapGenerationStage.js";

/**
 * Carves routes and records merge, trunk, and per-path routing artifacts.
 */
export class PathStage extends AbstractMapGenerationStage {
  /**
   * @type {import("../PathCarver.js").PathCarver}
   */
  #paths;

  /**
   * @type {import("../OverpassPlanner.js").OverpassPlanner}
   */
  #overpasses;

  /**
   * @type {import("../IslandBuilder.js").IslandBuilder}
   */
  #island;

  /**
   * @param {import("../PathCarver.js").PathCarver} paths
   * @param {import("../OverpassPlanner.js").OverpassPlanner} overpasses
   * @param {import("../IslandBuilder.js").IslandBuilder} island
   */
  constructor(paths, overpasses, island) {
    super();
    this.#paths = paths;
    this.#overpasses = overpasses;
    this.#island = island;
  }

  /**
   * @param {import("../GenerationContext.js").GenerationContext} context
   */
  async run(context) {
    const { grid, tileMeta, islandMask } = context.world;
    const { layout } = context.routing;
    const { mergeZones, routeCellsByPath, trunkStart } =
      this.#paths.carvePaths(grid, tileMeta, layout);
    this.#overpasses.configureOverpassEntryPlateau(
      grid,
      layout.overpassPlan,
      routeCellsByPath,
    );
    this.#island.materializeSingleCellTerrainHoles(
      grid,
      tileMeta,
      islandMask,
    );
    if (layout.overpassPlan &&
      !this.#overpasses.overpassPlanFits(layout.overpassPlan, islandMask, grid)) {
      throw new InvalidOverpassError({ reason: "does not fit its reserved terrain" });
    }

    Object.assign(context.routing, {
      mergeZones,
      routeCellsByPath,
      trunkStart,
    });
  }
}
