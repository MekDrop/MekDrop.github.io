import modelUrl from "../../../models/castle/props/kitchen-utensil-rail.glb?url";
import { AbstractCastleProp } from "../../shared/AbstractCastleProp.js";

/**
 * Wall-mounted forged rail with connected brackets and three open hooks.
 */
export class KitchenUtensilRail extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() {
    return modelUrl;
  }
}
