import modelUrl from "../../models/castle/props/sewing-basket.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Wicker mending basket containing cloth rolls and thread spools.
 */
export class SewingBasket extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
