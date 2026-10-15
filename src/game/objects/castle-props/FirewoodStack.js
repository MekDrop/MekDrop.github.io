import modelUrl from "../../models/castle/props/firewood-stack.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Compact cut logs stacked on the kitchen floor beside the hearth.
 */
export class FirewoodStack extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
