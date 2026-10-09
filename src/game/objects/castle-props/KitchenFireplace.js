import modelUrl from "../../models/castle/props/kitchen-fireplace.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Authored kitchen fireplace placed through the map objects array.
 */
export class KitchenFireplace extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
