import { CastleResidentialLayout } from "../../castle/residents/CastleResidentialLayout.js";

/**
 * Publishes both planned and compact castle beds through normal map ownership.
 */
export class CastleBedMapObjects {
  /**
   * @param {import("../../../GameContracts.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    const objects = mapData.objects ??= [];
    for (const castle of objects.filter(CastleBedMapObjects.#isCastle)) {
      const layout = new CastleResidentialLayout(castle.buildPlan);
      for (let index = objects.length - 1; index >= 0; index--) {
        if (objects[index].castleBed && objects[index].sourceCastleId === castle.id) {
          objects.splice(index, 1);
        }
      }
      let index = 0;
      for (const placement of layout.placements) {
        if (!["royalBed", "servantBed"].includes(placement.role)) {
          continue;
        }
        const position = { ...placement.position };
        objects.push({
          id: `${castle.id}-bed-${index++}`,
          object: "Bed",
          variant: placement.role === "royalBed" ? "royal" : "servant",
          position,
          rotation: placement.yaw,
          collisionRotation: layout.yaw,
          scale: placement.scale.x,
          stretch: {
            x: 1,
            y: placement.scale.y / placement.scale.x,
            z: placement.scale.z / placement.scale.x,
          },
          footprint: placement.footprint,
          generated: true,
          castleBed: true,
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
   * @param {import("../../ObjectTypes.js").MapObjectDefinition} definition
   */
  static #isCastle(definition) {
    return definition.object === "Castle";
  }
}
