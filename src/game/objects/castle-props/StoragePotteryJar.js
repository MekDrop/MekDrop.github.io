import modelUrl from "../../models/castle/props/storage-pottery-jar.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Authored storage pottery jar placed through the map objects array.
 */
export class StoragePotteryJar extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
