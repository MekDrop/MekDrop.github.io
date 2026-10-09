import modelUrl from "../../models/castle/props/floor-candelabrum.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Authored floor candelabrum placed through the map objects array.
 */
export class FloorCandelabrum extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
