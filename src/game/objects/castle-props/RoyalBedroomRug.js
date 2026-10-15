import modelUrl from "../../models/castle/props/royal-bedroom-rug.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Blue woven carpet with gold borders matching the royal bed.
 */
export class RoyalBedroomRug extends AbstractCastleProp {
  /**
   * @returns {boolean}
   */
  static get hasAuthoredCollision() { return false; }
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
