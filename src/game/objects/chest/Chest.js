import modelUrl from "../../models/castle/props/wooden-storage-chest.glb?url";
import { AbstractCastleProp } from "../castle-props/AbstractCastleProp.js";

/**
 * Low plank-built chest with authored lid, braces, fittings and mesh collision.
 */
export class Chest extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }

  /**
   * Normalize saved prop names after castle preparation publishes furnishings.
   * @param {import("../../GameContracts.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    for (const definition of mapData.objects ?? []) {
      if (definition.object === "WoodenStorageChest") {
        definition.object = Chest.name;
      }
    }
  }
}
