import modelUrl from "../../models/castle/residential/banner-cloth.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Existing royal cloth, mounted at its authored top-center pivot.
 */
export class VestibuleBanner extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
