import { CastleResidentialLayout } from "../../residents/CastleResidentialLayout.js";

/**
 * Publishes generator-owned court props through the registered map classes.
 */
export class ThroneRoomMapObjects {
  /**
   * @param {import("../../../../GameContracts.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    const objects = mapData.objects ?? [];
    const castles = objects.filter(ThroneRoomMapObjects.#filterDefinition);
    const castleIds = new Set(castles.map(ThroneRoomMapObjects.#mapCastle));
    // A regenerated castle must replace its old seed's props, including omissions.
    mapData.objects = objects.filter(/**
     *
     * @param {import("../../../ObjectTypes.js").MapObjectDefinition} definition
     */
      (definition) =>
        !definition.courtFurnishing || !castleIds.has(definition.sourceCastleId));
    for (const castle of castles) {
      const plan = castle.buildPlan?.metadata?.runtime?.residential;
      if (!plan?.basePlanId) { continue; }
      const layout = new CastleResidentialLayout(castle.buildPlan);
      for (const [index, item] of plan.furniture.entries()) {
        if (item.role !== "courtProp" || !item.object) { continue; }
        const position = layout.toWorld(item.x, item.z,
          item.floorY - layout.origin.y + (item.elevation ?? 0));
        const rotation = layout.yaw + 180 + (item.rotation ?? 0);
        const definition = {
          id: `${castle.id}-court-${index}`,
          object: item.object,
          variant: item.variant,
          ...(item.type ? { type: item.type } : {}),
          ...item.properties,
          position,
          rotation,
          scale: item.scale,
          stretch: item.stretch,
          generated: true,
          sourceCastleId: castle.id,
          courtFurnishing: true,
          tile: {
            col: Math.round(position.x + (mapData.cols - 1) / 2),
            row: Math.round(position.z + (mapData.rows - 1) / 2),
          },
        };
        if (item.object === "Shelf") {
          const angle = rotation * Math.PI / 180;
          definition.from = {
            x: position.x - Math.cos(angle) * 0.425,
            y: position.y,
            z: position.z + Math.sin(angle) * 0.425,
          };
          definition.to = {
            x: position.x + Math.cos(angle) * 0.425,
            y: position.y,
            z: position.z - Math.sin(angle) * 0.425,
          };
          if (Math.abs(Math.cos(angle)) < 0.5) { definition.from.x = definition.to.x = position.x; }
          else { definition.from.z = definition.to.z = position.z; }
          definition.facing = Math.abs(Math.cos(angle)) > 0.5 ? Math.cos(angle) > 0 ? 1 : -1 : Math.sin(angle) > 0 ? 1 : -1;
          definition.height = item.height;
          definition.seed = `${castle.buildPlan.input.seed}:court:${index}`;
        }
        mapData.objects.push(definition);
      }
    }
  }

  /**
   *
   * @param {import("../../../ObjectTypes.js").MapObjectDefinition} definition
   */
  static #filterDefinition(definition) {
    return definition.object === "Castle";
  }

  /**
   *
   * @param {import("../../../ObjectTypes.js").MapObjectDefinition} castle
   */
  static #mapCastle(castle) {
    return castle.id;
  }
}
