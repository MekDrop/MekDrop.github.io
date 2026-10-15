import { CastleResidentialLayout } from "../../CastleResidentialLayout.js";
import { KitchenChimneyLayout } from "../../KitchenChimneyLayout.js";

/**
 * Publishes room-authored kitchen and service props through the map lifecycle.
 */
export class KitchenRoomMapObjects {
  /**
   * @param {import("../../../ObjectTypes.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    const objects = mapData.objects ?? [];
    for (const castle of objects.filter(/**
     *
     * @param {import("../../../ObjectTypes.js").MapObjectDefinition} definition
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
        const chimneyHeight = item.object === "Fireplace"
          ? KitchenChimneyLayout.height(castle.buildPlan, item, position, rotation) : undefined;
        objects.push({ ...(item.items ? { items: item.items, color: item.color } : {}), id, object: item.object, variant: item.variant, texture: item.texture, model: item.model, position, rotation, scale: item.scale, generated: true, kitchenFurnishing: true,
          ...(item.object === "Fireplace" ? {
            chimneyHeight,
            chimneyMetalTerminal: KitchenChimneyLayout.hasTerraceTerminal(castle.buildPlan, item, position, chimneyHeight),
          } : {}),
          sourceCastleId: castle.id, tile: { col: Math.round(position.x + (mapData.cols - 1) / 2),
            row: Math.round(position.z + (mapData.rows - 1) / 2) } });
        if (item.object === "Fireplace") {
          const scale = item.scale ?? 1;
          const angle = rotation * Math.PI / 180;
          objects.push({
            id: `${id}-fire`, object: "Fire",
            position: { x: position.x - Math.sin(angle) * 0.06 * scale,
              y: position.y + 0.29 * scale, z: position.z - Math.cos(angle) * 0.06 * scale },
            rotation, volume: { x: 0.64 * scale, y: 0.3 * scale, z: 0.6 * scale },
            intensity: 0.75, generated: true, kitchenFurnishing: true, sourceCastleId: castle.id,
            tile: { col: Math.round(position.x + (mapData.cols - 1) / 2),
              row: Math.round(position.z + (mapData.rows - 1) / 2) },
          });
        }
      }
    }
    mapData.objects = objects;
  }
}
