import modelUrl from "../../models/castle/props/woven-rug.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Thin woven floor covering; the castle floor provides physical support.
 */
export class WovenRug extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
  /**
   * @returns {boolean}
   */
  static get hasAuthoredCollision() { return false; }
}
