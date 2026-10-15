import { CastleResidentialLayout } from "./CastleResidentialLayout.js";

/**
 * Publishes authored crown access through the ordinary map object registry.
 */
export class CastleLadderMapObjects {
  /**
   * @param {import("../../GameContracts.js").GameMapData} map
   */
  static prepareMap(map) {
    map.objects = (map.objects ?? []).filter(
      CastleLadderMapObjects.#filterItem,
    );
    for (const castle of [...map.objects]) {
      const plan = castle.buildPlan?.metadata?.runtime?.residential;
      const access = plan?.roofAccess;
      if (castle.object !== "Castle" || !access) { continue; }
      const layout = new CastleResidentialLayout(castle.buildPlan);
      const position = access.position ?? access.bottom;
      const hole = access.hole;
      const across = Math.abs(Math.sin(((access.rotation ?? layout.yaw) - layout.yaw) * Math.PI / 180)) > 0.5;
      const hatch = hole ? {
        position: layout.toWorld((hole.minX + hole.maxX) / 2, (hole.minZ + hole.maxZ) / 2, access.top.y - layout.origin.y),
        width: across ? hole.maxZ - hole.minZ : hole.maxX - hole.minX,
        depth: across ? hole.maxX - hole.minX : hole.maxZ - hole.minZ,
      } : undefined;
      map.objects.push({
        id: `${castle.id}-crown-ladder`,
        object: "Ladder",
        position,
        bottom: access.bottom,
        top: access.top,
        hatch,
        rotation: access.rotation ?? layout.yaw,
        generated: true,
        sourceCastleId: castle.id,
        tile: {
          col: Math.round(position.x + (map.cols - 1) / 2),
          row: Math.round(position.z + (map.rows - 1) / 2),
        },
      });
    }
  }

  /**
   * @param {import("../ObjectTypes.js").MapObjectDefinition} item
   */
  static #filterItem(item) {
    return !(item.generated && item.object === "Ladder" && item.sourceCastleId);
  }
}
