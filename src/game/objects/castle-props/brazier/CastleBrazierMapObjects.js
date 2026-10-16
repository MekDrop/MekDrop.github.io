/**
 * Publishes generated castle bowls through normal map object ownership.
 */
export class CastleBrazierMapObjects {
  /**
   * @param {import("../../../GameContracts.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    const objects = mapData.objects ??= [];
    for (const castle of objects.filter(CastleBrazierMapObjects.#isCastle)) {
      for (let index = objects.length - 1; index >= 0; index--) {
        if (objects[index].castleBrazier && objects[index].sourceCastleId === castle.id) {
          objects.splice(index, 1);
        }
      }
      const { x, z } = castle.buildPlan.input.position;
      for (const [index, flame] of (castle.buildPlan.geometry.decorations.flames ?? []).entries()) {
        objects.push({
          id: `${castle.id}-brazier-${index}`,
          object: "Brazier",
          position: {
            x: flame.x,
            y: flame.y,
            z: flame.z,
          },
          scale: flame.scale ?? 0.25,
          intensity: flame.intensity ?? 1,
          phase: flame.phase ?? index * 1.713 + flame.x * 0.37 + flame.z * 0.53,
          flame: flame.flame ?? true,
          generated: true,
          castleBrazier: true,
          sourceCastleId: castle.id,
          tile: {
            col: Math.floor(x + mapData.cols / 2),
            row: Math.floor(z + mapData.rows / 2),
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
