import { CastleResidentialLayout } from "./CastleResidentialLayout.js";
import { KitchenChimneyLayout } from "./KitchenChimneyLayout.js";

/**
 * Publishes room-authored kitchen and service props through the map lifecycle.
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
      if (!plan?.furniture) { continue; }
      const layout = new CastleResidentialLayout(castle.buildPlan);
      // Regeneration replaces the kitchen's records even when optional counts change.
      for (let index = objects.length - 1; index >= 0; index--) {
        if (objects[index].kitchenFurnishing && objects[index].sourceCastleId === castle.id) { objects.splice(index, 1); }
      }
      for (const [index, item] of plan.furniture.entries()) {
        if (!["kitchenProp", "serviceProp"].includes(item.role) || !item.object) { continue; }
        const id = `${castle.id}-kitchen-prop-${index}`;
        const position = layout.toWorld(item.x, item.z, item.floorY - layout.origin.y + (item.y ?? 0));
        // Only compiled base plans transform both horizontal coordinates by 180°.
        const rotation = layout.yaw + (plan.basePlanId ? 180 : 0) + (item.rotation ?? 0);
        const chimneyHeight = item.object === "KitchenFireplace"
          ? KitchenChimneyLayout.height(castle.buildPlan, item, position, rotation) : undefined;
        objects.push({ id, object: item.object, position, rotation, scale: item.scale, generated: true, kitchenFurnishing: true,
          ...(item.object === "KitchenFireplace" ? {
            chimneyHeight,
            chimneyMetalTerminal: KitchenChimneyLayout.hasTerraceTerminal(castle.buildPlan, item, position, chimneyHeight),
          } : {}),
          sourceCastleId: castle.id, tile: { col: Math.round(position.x + (mapData.cols - 1) / 2),
            row: Math.round(position.z + (mapData.rows - 1) / 2) } });
      }
    }
    mapData.objects = objects;
  }
}
