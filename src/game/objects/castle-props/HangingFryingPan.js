import modelUrl from "../../models/castle/props/hanging-frying-pan.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Authored hanging frying pan placed through the map objects array.
 */
export class HangingFryingPan extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
