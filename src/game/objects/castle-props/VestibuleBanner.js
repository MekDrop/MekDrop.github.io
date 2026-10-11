import modelUrl from "../../models/castle/props/vestibule-banner.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Folded navy banner with an oak rod and embroidered castle, mounted at the top.
 */
export class VestibuleBanner extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
