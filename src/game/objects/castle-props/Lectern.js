import modelUrl from "../../models/castle/props/court-lectern.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Compact clerk's lectern authored from the game-style reference.
 */
export class Lectern extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }

  /**
   * Normalize lecterns in older saved maps.
   * @param {import("../ObjectTypes.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    for (const definition of mapData.objects ?? []) {
      if (definition.object !== "CourtLectern") { continue; }
      definition.object = Lectern.name;
      definition.type = "court";
    }
  }
}
