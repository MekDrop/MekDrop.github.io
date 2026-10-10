import { CastleResidentialLayout } from "./CastleResidentialLayout.js";
import { KitchenChimneyLayout } from "./KitchenChimneyLayout.js";

/**
 * Publishes room-authored kitchen props through the normal map object lifecycle.
 */
export class KitchenRoomMapObjects {
  /**
   * @param {import("../ObjectTypes.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    const objects = mapData.objects ?? [];
    for (const castle of objects.filter(/**
     *
     * @param {import("../ObjectTypes.js").MapObjectDefinition} definition
     */
    definition => definition.object === "Castle")) {
      const plan = castle.buildPlan?.metadata?.runtime?.residential;
      if (!plan?.basePlanId) { continue; }
      const layout = new CastleResidentialLayout(castle.buildPlan);
      // Regeneration replaces the kitchen's records even when optional counts change.
      for (let index = objects.length - 1; index >= 0; index--) {
        if (objects[index].kitchenFurnishing && objects[index].sourceCastleId === castle.id) { objects.splice(index, 1); }
      }
      for (const [index, item] of plan.furniture.entries()) {
        if (!["kitchenProp", "serviceProp"].includes(item.role) || !item.object) { continue; }
        const id = `${castle.id}-kitchen-prop-${index}`;
        const position = layout.toWorld(item.x, item.z, item.floorY - layout.origin.y + (item.y ?? 0));
        // The authored plan transforms both horizontal coordinates by 180°.
        const rotation = layout.yaw + 180 + (item.rotation ?? 0);
        objects.push({ id, object: item.object, position, rotation, scale: item.scale, generated: true, kitchenFurnishing: true,
          ...(item.object === "KitchenFireplace" ? {
            chimneyHeight: KitchenChimneyLayout.height(castle.buildPlan, item, position, rotation),
          } : {}),
          sourceCastleId: castle.id, tile: { col: Math.round(position.x + (mapData.cols - 1) / 2),
            row: Math.round(position.z + (mapData.rows - 1) / 2) } });
      }
    }
    mapData.objects = objects;
  }
}
