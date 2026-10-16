import modelUrl from "../../../models/castle/props/storage-pottery-jar.glb?url";
import { AbstractCastleProp } from "../../shared/AbstractCastleProp.js";

/**
 * Standalone authored pottery jar placed through the map objects array.
 */
export class PotteryJar extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() {
    return modelUrl;
  }
}
