import { CastleResidentialLayout } from "./CastleResidentialLayout.js";

/**
 * Publish stair-room decoration through registered map object classes.
 */
export class StairwellRoomMapObjects {
  /**
   * @param {import("../ObjectTypes.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    const objects = mapData.objects ??= [];
    for (const castle of [...objects]) {
      const plan = castle.object === "Castle" ? castle.buildPlan?.metadata?.runtime?.residential : null;
      if (!plan?.basePlanId) { continue; }
      const layout = new CastleResidentialLayout(castle.buildPlan);
      for (let index = objects.length - 1; index >= 0; index--) {
        if (objects[index].stairwellFurnishing && objects[index].sourceCastleId === castle.id) {
          objects.splice(index, 1);
        }
      }
      for (const [index, item] of plan.furniture.entries()) {
        if (item.role !== "stairwellProp") { continue; }
        const id = `${castle.id}-stairwell-prop-${index}`;
        if (objects.some(/**
         * @param {import("../ObjectTypes.js").MapObjectDefinition} definition
         */ definition => definition.id === id)) { continue; }
        const position = layout.toWorld(item.x, item.z, item.floorY - layout.origin.y + item.y);
        objects.push({ id, object: item.object, position, rotation: layout.yaw + (item.underStair ? 0 : 180) + item.rotation,
          scale: item.scale, stretch: item.stretch, tilt: item.tilt, weathering: item.weathering,
          generated: true, stairwellFurnishing: true, sourceCastleId: castle.id, tile: castle.tile });
      }
    }
  }
}
