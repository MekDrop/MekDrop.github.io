import { CastleResidentialLayout } from "../../CastleResidentialLayout.js";

/**
 * Publishes bedroom decorations as normal map objects with their own lifecycles.
 */
export class RoyalBedroomRoomMapObjects {
  /**
   * @param {import("../../../../GameContracts.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    const objects = mapData.objects ?? [];
    for (const castle of objects.filter(/**
     * @param {import("../../../ObjectTypes.js").MapObjectDefinition} definition
     */ definition => definition.object === "Castle")) {
      const plan = castle.buildPlan?.metadata?.runtime?.residential;
      if (!plan?.furniture) { continue; }
      const layout = new CastleResidentialLayout(castle.buildPlan);
      for (let index = objects.length - 1; index >= 0; index--) {
        if (objects[index].royalBedroomFurnishing && objects[index].sourceCastleId === castle.id) { objects.splice(index, 1); }
      }
      for (const item of plan.furniture) {
        if (item.role !== "royalBedroomProp" || !item.object) { continue; }
        const position = layout.toWorld(item.x, item.z, item.floorY - layout.origin.y + (item.y ?? 0));
        objects.push({ id: `${castle.id}-${item.id}`, object: item.object, position,
          rotation: layout.yaw + (plan.basePlanId ? 180 : 0) + (item.rotation ?? 0),
          scale: item.scale, generated: true, royalBedroomFurnishing: true, sourceCastleId: castle.id,
          tile: { col: Math.round(position.x + (mapData.cols - 1) / 2), row: Math.round(position.z + (mapData.rows - 1) / 2) } });
      }
    }
    mapData.objects = objects;
  }
}
