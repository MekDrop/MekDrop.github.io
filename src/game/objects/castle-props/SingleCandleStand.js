import modelUrl from "../../models/castle/props/single-candle-stand.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Authored single candle stand placed through the map objects array.
 */
export class SingleCandleStand extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
