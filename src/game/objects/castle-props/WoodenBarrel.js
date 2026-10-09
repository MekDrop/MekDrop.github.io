import modelUrl from "../../models/castle/props/wooden-barrel.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Authored wooden barrel placed through the map objects array.
 */
export class WoodenBarrel extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
