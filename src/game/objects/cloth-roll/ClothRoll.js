import creamUrl from "../../models/cloth-roll/cream-cloth-roll.glb?url";
import blueUrl from "../../models/cloth-roll/blue-cloth-roll.glb?url";
import { AbstractCastleProp } from "../castle-props/AbstractCastleProp.js";

/**
 * One original sewing fabric roll, independently placeable or contained by a basket.
 */
export class ClothRoll extends AbstractCastleProp {
  /**
   * @returns {string[]}
   */
  static get modelUrls() { return [creamUrl, blueUrl]; }

  /**
   * @returns {string}
   */
  get modelUrl() {
    if (this.definition.variant === "cream") { return creamUrl; }
    return blueUrl;
  }
}
