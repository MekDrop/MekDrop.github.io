import { CastleDataBuilder } from "../CastleDataBuilder.js";
import { AbstractMapGenerationStage } from "../AbstractMapGenerationStage.js";

/**
 * Derives castle data after validation. Finalization derives walking routes
 * from the resulting tiles rather than the generator layout.
 */
export class RouteDataStage extends AbstractMapGenerationStage {
  /**
   * @type {CastleDataBuilder}
   */
  #castle = new CastleDataBuilder();

  /**
   *
   * @param {import("../GenerationContext.js").GenerationContext} context
   */
  async run(context) {
    const { grid } = context.world;
    const { layout } = context.routing;
    context.output.castle = this.#castle.buildCastleData(grid, layout);
  }
}
