import modelUrl from "../../models/castle/props/wooden-water-bucket.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Hollow water bucket with pivoted iron bail and wooden grip.
 */
export class WoodenWaterBucket extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
