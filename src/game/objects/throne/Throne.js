import modelUrl from "../../models/castle/props/throne.glb?url";
import { CastleResidentialLayout } from "../castle/CastleResidentialLayout.js";
import { AbstractCastleProp } from "../castle-props/AbstractCastleProp.js";

/**
 * Authored throne placed through the map objects array.
 */
export class Throne extends AbstractCastleProp {
  /**
   * Publish castle seating as independent map objects.
   * @param {import("../ObjectTypes.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    const objects = mapData.objects ??= [];
    for (const castle of [...objects]) {
      if (castle.object !== "Castle" || !castle.buildPlan?.metadata?.runtime?.residential) { continue; }
      const layout = new CastleResidentialLayout(castle.buildPlan);
      const room = layout.audienceFloorBounds ?? layout.rooms.work;
      const zone = layout.reservations.find(Throne.#findReservation);
      const forward = (zone?.maxZ ?? room.maxZ) - (layout.throneRearWindow ? 0.35 : 0.65);
      const position = layout.toWorld((room.minX + room.maxX) / 2, Math.max(0, forward), layout.throneSupportHeight);
      const id = castle.id + "-throne";
      const definition = {
        id,
        object: Throne.name,
        position,
        rotation: layout.yaw + 270,
        scale: 0.85,
        tile: castle.tile,
        generated: true,
        sourceCastleId: castle.id,
      };
      const existing = objects.findIndex(
        /**
         * @param {import("../ObjectTypes.js").MapObjectDefinition} item
         */
        item => item.id === id,
      );
      if (existing >= 0) { objects[existing] = definition; }
      else { objects.push(definition); }
    }
  }

  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }

  /**
   * @param {{role: string}} reservation
   */
  static #findReservation(reservation) {
    return reservation.role === "throne";
  }
}
