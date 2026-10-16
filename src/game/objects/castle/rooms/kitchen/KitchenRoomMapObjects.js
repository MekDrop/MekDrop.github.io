import { CastleResidentialLayout } from "../../residents/CastleResidentialLayout.js";
import { FireplaceGenerator } from "../../../castle-props/fireplace/FireplaceGenerator.js";

/**
 * Publishes room-authored kitchen and service props through the map lifecycle.
 */
export class KitchenRoomMapObjects {
  /**
   * @param {import("../../../ObjectTypes.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    const objects = mapData.objects ?? [];
    for (const castle of objects.filter(
      KitchenRoomMapObjects.#filterDefinition,
    )) {
      const plan = castle.buildPlan?.metadata?.runtime?.residential;
      if (!plan?.furniture) {
        continue;
      }
      const layout = new CastleResidentialLayout(castle.buildPlan);
      // Regeneration replaces the kitchen's records even when optional counts change.
      for (let index = objects.length - 1; index >= 0; index--) {
        if (objects[index].kitchenFurnishing && objects[index].sourceCastleId === castle.id) {
          objects.splice(index, 1);
        }
      }
      for (const [index, item] of plan.furniture.entries()) {
        if (!["kitchenProp", "serviceProp"].includes(item.role) || !item.object) {
          continue;
        }
        const id = `${castle.id}-kitchen-prop-${index}`;
        const position = layout.toWorld(item.x, item.z, item.floorY - layout.origin.y + (item.y ?? 0));
        // Only compiled base plans transform both horizontal coordinates by 180°.
        const rotation = layout.yaw + (plan.basePlanId ? 180 : 0) + (item.rotation ?? 0);
        const definition = {
          ...(item.items ? {
            items: item.items,
            color: item.color,
          } : {}),
          id,
          object: item.object,
          variant: item.variant,
          texture: item.texture,
          model: item.model,
          ...item.properties,
          position,
          rotation,
          scale: item.scale,
          generated: true,
          kitchenFurnishing: true,
          sourceCastleId: castle.id,
          tile: {
            col: Math.round(position.x + (mapData.cols - 1) / 2),
            row: Math.round(position.z + (mapData.rows - 1) / 2),
          },
        };
        objects.push(item.object === "Fireplace"
          ? FireplaceGenerator.generate(castle.buildPlan, item, definition) : definition);
        if (item.object === "Fireplace") {
          const scale = item.scale ?? 1;
          const angle = rotation * Math.PI / 180;
          objects.push({
            id: `${id}-fire`,
            object: "Fire",
            position: {
              x: position.x - Math.sin(angle) * 0.06 * scale,
              y: position.y + 0.29 * scale,
              z: position.z - Math.cos(angle) * 0.06 * scale,
            },
            rotation,
            volume: {
              x: 0.64 * scale,
              y: 0.3 * scale,
              z: 0.6 * scale,
            },
            intensity: 0.75,
            generated: true,
            kitchenFurnishing: true,
            sourceCastleId: castle.id,
            tile: {
              col: Math.round(position.x + (mapData.cols - 1) / 2),
              row: Math.round(position.z + (mapData.rows - 1) / 2),
            },
          });
        }
      }
    }
    mapData.objects = objects;
  }

  /**
   *
   * @param {import("../../../ObjectTypes.js").MapObjectDefinition} definition
   */
  static #filterDefinition(definition) {
    return definition.object === "Castle";
  }
}
