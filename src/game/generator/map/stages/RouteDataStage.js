import { RouteDataBuilder } from "../RouteDataBuilder.js";
import { CastleDataBuilder } from "../CastleDataBuilder.js";
import { AbstractMapGenerationStage } from "../AbstractMapGenerationStage.js";

/**
 * Derives consumer-facing route, arrow, and castle data after validation.
 */
export class RouteDataStage extends AbstractMapGenerationStage {
  /**
   * @type {RouteDataBuilder}
   */
  #routes = new RouteDataBuilder();

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
    const { routes, arrowData } = this.#routes.buildRouteData(layout);
    context.output.routes = routes;
    context.output.arrowData = arrowData;
    context.output.castle = this.#castle.buildCastleData(grid, layout);
  }
}
