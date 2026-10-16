import { CastleResidentialLayout } from "../../residents/CastleResidentialLayout.js";

/**
 * Publishes the tower generator's props through their registered object classes.
 */
export class TowerRoomMapObjects {
  /**
   * Replace the tower's old seed instead of accumulating furniture on regeneration.
   * @param {import("../../../ObjectTypes.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    const objects = mapData.objects ?? [];
    const castles = objects.filter(TowerRoomMapObjects.#filterDefinition);
    const prefixes = castles.map(TowerRoomMapObjects.#mapCastle);
    mapData.objects = objects.filter(/**
                                      * @param {import("../../../ObjectTypes.js").MapObjectDefinition} definition
                                      */
      (definition) => !prefixes.some(/**
                                      * @param {string} prefix
                                      */
        (prefix) => definition.generated && definition.id.startsWith(prefix)));
    for (const castle of castles) {
      const plan = castle.buildPlan?.metadata?.runtime?.residential;
      if (!plan?.basePlanId) {
        continue;
      }
      const layout = new CastleResidentialLayout(castle.buildPlan);
      for (const [index, item] of plan.furniture.entries()) {
        if (item.role !== "towerProp" || !item.object) {
          continue;
        }
        const position = layout.toWorld(item.x, item.z, item.floorY - layout.origin.y + (item.yOffset ?? 0));
        let rotation = layout.yaw + 180 + (item.rotation ?? 0);
        if (item.object === "Chair") {
          const room = plan.placedRooms.find(/**
           * @param {import("../../../../generator/castle/rooms/AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
           */
            (room) => room.id === item.roomId);
          // The chair faces -X, unlike the compiler's +Z-facing convention.
          // Derive its facing from final bounds so reflected plans keep it inward.
          rotation = layout.yaw + (item.z < (room.minZ + room.maxZ) / 2 ? 90 : 270);
        }
        mapData.objects.push({
          id: `${castle.id}-tower-furnishing-${item.roomId}-${index}`,
          object: item.object,
          variant: item.variant,
          ...item.properties,
          position,
          rotation,
          scale: item.scale,
          generated: true,
          sourceCastleId: castle.id,
          tile: {
            col: Math.round(position.x + (mapData.cols - 1) / 2),
            row: Math.round(position.z + (mapData.rows - 1) / 2),
          },
        });
      }
    }
  }

  /**
   * @param {import("../../../ObjectTypes.js").MapObjectDefinition} definition
   */
  static #filterDefinition(definition) {
    return definition.object === "Castle";
  }

  /**
   * @param {import("../../../ObjectTypes.js").MapObjectDefinition} castle
   */
  static #mapCastle(castle) {
    return `${castle.id}-tower-furnishing-`;
  }
}
