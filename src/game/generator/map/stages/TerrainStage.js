import { AbstractMapGenerationStage } from "../AbstractMapGenerationStage.js";

/**
 * Resolves terrain smoothing, banks, supports, dips, and tile elevations.
 */
export class TerrainStage extends AbstractMapGenerationStage {
  #operations;

  constructor(operations) {
    super();
    this.#operations = operations;
  }

  async run(context) {
    const { grid, heightmap, tileMeta, islandMask } = context.world;
    const { layout, mergeZones } = context.routing;
    const { riverData } = context.features;
    this.#operations.smoothGrassHeights(grid, heightmap);
    this.#operations.applyOverpassTerrain(
      grid,
      heightmap,
      tileMeta,
      layout.overpassPlan,
    );
    this.#operations.materializeRiverBanks(
      grid,
      heightmap,
      tileMeta,
      islandMask,
      riverData,
    );
    this.#operations.materializePathSupports(
      grid,
      heightmap,
      tileMeta,
      riverData,
    );
    await context.scheduler.yieldIfNeeded(context.yieldState);
    layout.pathDipPlans = this.#operations.applyTerrainBridgeDips(
      grid,
      heightmap,
      tileMeta,
      riverData,
      mergeZones,
    );
    this.#operations.applyHeightsToMetadata(
      grid,
      tileMeta,
      heightmap,
      riverData,
    );
    this.#operations.materializeSingleCellTerrainHoles(
      grid,
      tileMeta,
      islandMask,
      heightmap,
    );
  }
}
