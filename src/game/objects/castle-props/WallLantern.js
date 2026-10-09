import modelUrl from "../../models/castle/props/wall-lantern.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Authored wall lantern placed through the map objects array.
 */
export class WallLantern extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
