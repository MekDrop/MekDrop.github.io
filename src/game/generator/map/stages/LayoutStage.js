import { CastleBasePlanGenerator } from "../../castle/CastleBasePlanGenerator.js";
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
    const castleSeed = mapName;
    const basePlan = await CastleBasePlanGenerator.generate({ seed: castleSeed, unitMetres: 1 });
    // West-facing plans swap their north-up axes; leave one tile around the walls.
    const layout = this.#layout.createLayoutConfig(numPaths, {
      basePlanId: basePlan.basePlanId, width: Math.ceil(basePlan.depth) + 2, depth: Math.ceil(basePlan.width) + 2, entranceInset: basePlan.entrance.center - basePlan.width / 2,
    });
    layout.castleSeed = castleSeed;
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
