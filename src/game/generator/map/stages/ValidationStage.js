import { TerrainValidator } from "../TerrainValidator.js";
import { RouteValidator } from "../RouteValidator.js";
import { PathSurfaceValidator } from "../PathSurfaceValidator.js";
import { DecorationValidator } from "../DecorationValidator.js";
import { RiverValidator } from "../RiverValidator.js";
import { AbstractMapGenerationStage } from "../AbstractMapGenerationStage.js";

/**
 * Applies the canonical validation sequence to all generated artifacts.
 */
export class ValidationStage extends AbstractMapGenerationStage {
  /**
   * @type {TerrainValidator}
   */
  #terrain = new TerrainValidator();

  /**
   * @type {RouteValidator}
   */
  #routes = new RouteValidator();

  /**
   * @type {PathSurfaceValidator}
   */
  #surfaces = new PathSurfaceValidator();

  /**
   * @type {DecorationValidator}
   */
  #decorations = new DecorationValidator();

  /**
   * @type {RiverValidator}
   */
  #rivers = new RiverValidator();

  /**
   *
   * @param {import("../GenerationContext.js").GenerationContext} context
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
    this.#rivers.validateRivers(
      grid,
      heightmap,
      tileMeta,
      islandMask,
      layout,
      riverData,
    );
    this.#terrain.validateNoSingleCellTerrainHoles(grid);
    this.#terrain.validateIslandConnectivity(grid);
    this.#routes.validateGatePlacement(grid, layout);
    this.#routes.validatePathSpacing(layout);
    await context.scheduler.yieldIfNeeded(context.yieldState);
    this.#routes.validateRouteSeparation(routeCellsByPath, layout);
    this.#routes.validateParallelPathClearance(grid, layout);
    this.#routes.validateFlatPathCrossings(grid, layout.overpassPlan);
    this.#routes.validateRouteReachability(grid, layout);
    this.#routes.validateCastleEntrance(grid, layout);
    this.#routes.validateCastleGroundClearance(grid, layout);
    await context.scheduler.yieldIfNeeded(context.yieldState);
    this.#surfaces.validateHeightDiscipline(grid, heightmap, tileMeta);
    this.#surfaces.validateOverpass(
      grid,
      heightmap,
      tileMeta,
      layout.overpassPlan,
    );
    this.#surfaces.validatePathRenderModes(grid, heightmap, tileMeta);
    this.#surfaces.validatePathDips(
      grid,
      heightmap,
      tileMeta,
      layout.pathDipPlans,
      riverData,
    );
    this.#surfaces.validateBridgeTurns(tileMeta);
    this.#surfaces.validateBridgeGroundHeights(
      heightmap,
      tileMeta,
      riverData,
    );
    this.#terrain.validateGrassNoise(
      grid,
      heightmap,
      tileMeta,
      riverData,
    );
    await context.scheduler.yieldIfNeeded(context.yieldState);
    this.#terrain.validateLayoutVariety(layout);
    this.#decorations.validateVegetation(
      grid,
      heightmap,
      tileMeta,
      layout,
      vegetationPlacements,
    );
    this.#decorations.validateStones(
      grid,
      heightmap,
      tileMeta,
      vegetationPlacements,
      stonePlacements,
    );
    this.#decorations.validateGroundCover(
      grid,
      heightmap,
      tileMeta,
      vegetationPlacements,
      stonePlacements,
      groundCoverData,
    );
  }
}
