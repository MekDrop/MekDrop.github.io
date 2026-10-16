import modelUrl from "../../models/castle/props/hanging-frying-pan.glb?url";
import { AbstractCastleProp } from "../shared/AbstractCastleProp.js";

/**
 * Wall-mounted iron rail carrying six textured medieval kitchen implements.
 */
export class HangingFryingPan extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
