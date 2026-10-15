import modelUrl from "../../models/castle/props/royal-bedroom-painting.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * A moonlit sailboat painting reserved for the royal bedroom.
 */
export class RoyalBedroomPainting extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
