import modelUrl from "../../models/castle/props/bedside-drawers.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Authored bedside drawers placed through the map objects array.
 */
export class BedsideDrawers extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
