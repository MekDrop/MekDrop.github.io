import { AbstractMapGenerationStage } from "../AbstractMapGenerationStage.js";

/**
 * Converts normalized input into the routing layout and river request.
 */
export class LayoutStage extends AbstractMapGenerationStage {
  /**
   * @type {import("../LayoutPlanner.js").LayoutPlanner}
   */
  #layout;

  /**
   * @type {import("../OverpassPlanner.js").OverpassPlanner}
   */
  #overpasses;

  /**
   * @param {import("../LayoutPlanner.js").LayoutPlanner} layout
   * @param {import("../OverpassPlanner.js").OverpassPlanner} overpasses
   */
  constructor(layout, overpasses) {
    super();
    this.#layout = layout;
    this.#overpasses = overpasses;
  }

  /**
   * @param {import("../GenerationContext.js").GenerationContext} context
   */
  async run(context) {
    const {
      numPaths: requestedNumPaths,
      numRivers: requestedNumRivers,
      overpass: requestedOverpass,
      mapName,
    } = context.input;
    const numPaths = this.#layout.selectPathCount(requestedNumPaths);
    const layout = this.#layout.createLayoutConfig(numPaths);
    layout.signature = mapName;
    layout.overpassPlan = this.#overpasses.selectOverpassPlan(
      layout,
      requestedOverpass,
    );
    if (!layout.overpassPlan) {
      this.#layout.retainSeparatedCurvePlans(layout);
    }

    context.routing.layout = layout;
    context.routing.requestedNumRivers = requestedNumRivers;
  }
}
