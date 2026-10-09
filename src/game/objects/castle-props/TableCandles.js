import modelUrl from "../../models/castle/props/table-candles.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Authored table candles placed through the map objects array.
 */
export class TableCandles extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
