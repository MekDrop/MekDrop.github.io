import { AbstractMapGenerationStage } from "../AbstractMapGenerationStage.js";

/**
 * Converts normalized input into the routing layout and river request.
 */
export class LayoutStage extends AbstractMapGenerationStage {
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
    const {
      numPaths: requestedNumPaths,
      numRivers: requestedNumRivers,
      overpass: requestedOverpass,
      mapName,
    } = context.input;
    const numPaths = this.#operations.selectPathCount(requestedNumPaths);
    const layout = this.#operations.createLayoutConfig(numPaths);
    layout.signature = mapName;
    layout.overpassPlan = this.#operations.selectOverpassPlan(
      layout,
      requestedOverpass,
    );
    if (!layout.overpassPlan) {
      this.#operations.retainSeparatedCurvePlans(layout);
    }

    context.routing.layout = layout;
    context.routing.requestedNumRivers = requestedNumRivers;
  }
}
