import modelUrl from "../../models/castle/props/spare-timber-bundle.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Spare boards stored upright in a narrow stairwell gap.
 */
export class SpareTimberBundle extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
