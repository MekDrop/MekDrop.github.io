import modelUrl from "../../models/castle/props/blue-armchair.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Authored blue armchair placed through the map objects array.
 */
export class BlueArmchair extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
