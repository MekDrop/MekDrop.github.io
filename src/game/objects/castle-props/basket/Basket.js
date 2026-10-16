import modelUrl from "../../../models/basket/basket.glb?url";
import { Bowl } from "../bowl/Bowl.js";

/**
 * Original wicker basket with independently authored contents.
 */
export class Basket extends Bowl {
  /**
   * @returns {string}
   */
  static get modelUrl() {
    return modelUrl;
  }
}
