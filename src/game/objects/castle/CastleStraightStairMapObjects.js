import { castleStraightStairAssemblies } from "./CastleStraightStairs.js";
import { CastleResidentialLayout } from "./CastleResidentialLayout.js";

/**
 * Emit complete assemblies through the ordinary registered object lifecycle.
 */
export class CastleStraightStairMapObjects {
  /**
   * @param {import("../../GameContracts.js").GameMapData} map
   */
  static prepareMap(map) {
    map.objects = (map.objects ?? []).filter(/**
     *
     * @param {import("../ObjectTypes.js").MapObjectDefinition} item
     */
    item =>
      !(item.generated && item.object === "StraightStaircase" && item.sourceCastleId));
    for (const castle of [...map.objects]) {
      if (castle.object !== "Castle" || !castle.buildPlan?.metadata?.runtime?.residential) { continue; }
      const layout = new CastleResidentialLayout(castle.buildPlan);
      for (const [index, stair] of castleStraightStairAssemblies(layout).entries()) {
        // Match Castle's footprint island rather than the staircase's edge tile.
        const {x,z} = castle.buildPlan.input.position;
        const { radius, rise, flightGap, flightShift, flightBounds, landingBack, landingLift, continuesAbove } = stair;
        map.objects.push({
          id: `${castle.id}-straight-stair-${stair.id ?? index}`,
          object: "StraightStaircase",
          position: { ...stair.center },
          rotation: stair.yaw,
          radius, rise, flightGap, flightShift, flightBounds, landingBack, landingLift,
          continuesAbove,
          exitFloorOwned: true,
          generated: true,
          sourceCastleId: castle.id,
          tile: { col: Math.floor(x + map.cols / 2), row: Math.floor(z + map.rows / 2) },
        });
      }
    }
  }
}
