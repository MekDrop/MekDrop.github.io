import modelUrl from "../../models/castle/props/wooden-crate.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Authored wooden crate placed through the map objects array.
 */
export class WoodenCrate extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
