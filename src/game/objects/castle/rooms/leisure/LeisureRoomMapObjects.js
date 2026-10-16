import { CastleResidentialLayout } from "../../residents/CastleResidentialLayout.js";

/**
 * Publishes leisure plants through registered map-object classes.
 */
export class LeisureRoomMapObjects {
  /**
   * @param {import("../../../../GameContracts.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    const objects = mapData.objects ?? [];
    for (const castle of objects.filter(
      LeisureRoomMapObjects.#filterDefinition,
    )) {
      const plan = castle.buildPlan?.metadata?.runtime?.residential;
      if (!plan?.basePlanId) { continue; }
      const layout = new CastleResidentialLayout(castle.buildPlan);
      const roomOrdinals = new Map();
      const generatedIds = new Set();
      for (const item of plan.furniture) {
        if (!item.role.startsWith("leisure") || item.object !== "Planter") { continue; }
        const index = roomOrdinals.get(item.roomId) ?? 0;
        roomOrdinals.set(item.roomId, index + 1);
        const id = `${castle.id}-leisure-${item.roomId}-${index}`;
        generatedIds.add(id);
        const existingIndex = objects.findIndex(/**
          * @param {import("../../../ObjectTypes.js").MapObjectDefinition} definition
          */
          (definition) => definition.id === id);
        const position = layout.toWorld(item.x, item.z, item.floorY - layout.origin.y + (item.yOffset ?? 0));
        // The compiler has already reflected yaw for mirrored seeds.
        const rotation = layout.yaw + 180 + (item.rotation ?? 0);
        const definition = {
          id,
          object: "Planter",
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
        };
        if (existingIndex >= 0) { objects[existingIndex] = definition; }
        else { objects.push(definition); }
      }
      for (let index = objects.length - 1; index >= 0; index--) {
        const definition = objects[index];
        if (definition.sourceCastleId === castle.id && definition.id.startsWith(`${castle.id}-leisure-`) &&
          !generatedIds.has(definition.id)) { objects.splice(index, 1); }
      }
    }
    mapData.objects = objects;
  }

  /**
   * @param {import("../../../ObjectTypes.js").MapObjectDefinition} definition
   */
  static #filterDefinition(definition) {
    return definition.object === "Castle";
  }
}
