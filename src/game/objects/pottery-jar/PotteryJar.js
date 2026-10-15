import modelUrl from "../../models/castle/props/storage-pottery-jar.glb?url";
import { AbstractCastleProp } from "../castle-props/AbstractCastleProp.js";

/**
 * Standalone authored pottery jar placed through the map objects array.
 */
export class PotteryJar extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }

  /**
   * Normalize saved jar names after castle preparation publishes furnishings.
   * @param {import("../../GameContracts.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    for (const definition of mapData.objects ?? []) {
      if (definition.object === "StoragePotteryJar") {
        definition.object = PotteryJar.name;
      }
    }
  }
}

