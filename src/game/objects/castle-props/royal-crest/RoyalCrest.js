import modelUrl from "../../../models/castle/residential/crown-crest.glb?url";
import { AbstractCastleProp } from "../../shared/AbstractCastleProp.js";

/**
 * Reuses the existing authored crown crest.
 */
export class RoyalCrest extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
