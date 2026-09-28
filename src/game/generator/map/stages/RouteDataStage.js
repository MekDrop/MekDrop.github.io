import { AbstractMapGenerationStage } from "../AbstractMapGenerationStage.js";

/**
 * Derives consumer-facing route, arrow, and castle data after validation.
 */
export class RouteDataStage extends AbstractMapGenerationStage {
  #operations;

  constructor(operations) {
    super();
    this.#operations = operations;
  }

  async run(context) {
    const { grid } = context.world;
    const { layout } = context.routing;
    const { routes, arrowData } = this.#operations.buildRouteData(layout);
    context.output.routes = routes;
    context.output.arrowData = arrowData;
    context.output.castle = this.#operations.buildCastleData(grid, layout);
  }
}
