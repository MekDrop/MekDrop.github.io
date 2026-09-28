import { AbstractMapGenerationStage } from "../AbstractMapGenerationStage.js";

/**
 * Applies the canonical validation sequence to all generated artifacts.
 */
export class ValidationStage extends AbstractMapGenerationStage {
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
    const { layout, routeCellsByPath } = context.routing;
    const {
      vegetationPlacements,
      stonePlacements,
      groundCoverData,
      riverData,
    } = context.features;
    this.#operations.validateRivers(
      grid,
      heightmap,
      tileMeta,
      islandMask,
      layout,
      riverData,
    );
    this.#operations.validateNoSingleCellTerrainHoles(grid);
    this.#operations.validateIslandConnectivity(grid);
    this.#operations.validateGatePlacement(grid, layout);
    this.#operations.validatePathSpacing(layout);
    await context.scheduler.yieldIfNeeded(context.yieldState);
    this.#operations.validateRouteSeparation(routeCellsByPath, layout);
    this.#operations.validateParallelPathClearance(grid, layout);
    this.#operations.validateFlatPathCrossings(grid, layout.overpassPlan);
    this.#operations.validateRouteReachability(grid, layout);
    this.#operations.validateCastleEntrance(grid, layout);
    this.#operations.validateCastleGroundClearance(grid, layout);
    await context.scheduler.yieldIfNeeded(context.yieldState);
    this.#operations.validateHeightDiscipline(grid, heightmap, tileMeta);
    this.#operations.validateOverpass(
      grid,
      heightmap,
      tileMeta,
      layout.overpassPlan,
    );
    this.#operations.validatePathRenderModes(grid, heightmap, tileMeta);
    this.#operations.validatePathDips(
      grid,
      heightmap,
      tileMeta,
      layout.pathDipPlans,
      riverData,
    );
    this.#operations.validateBridgeTurns(tileMeta);
    this.#operations.validateBridgeGroundHeights(
      heightmap,
      tileMeta,
      riverData,
    );
    this.#operations.validateGrassNoise(
      grid,
      heightmap,
      tileMeta,
      riverData,
    );
    await context.scheduler.yieldIfNeeded(context.yieldState);
    this.#operations.validateLayoutVariety(layout);
    this.#operations.validateVegetation(
      grid,
      heightmap,
      tileMeta,
      layout,
      vegetationPlacements,
    );
    this.#operations.validateStones(
      grid,
      heightmap,
      tileMeta,
      vegetationPlacements,
      stonePlacements,
    );
    this.#operations.validateGroundCover(
      grid,
      heightmap,
      tileMeta,
      vegetationPlacements,
      stonePlacements,
      groundCoverData,
    );
  }
}
