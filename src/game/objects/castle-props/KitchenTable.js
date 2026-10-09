import modelUrl from "../../models/castle/props/kitchen-table.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Authored kitchen table placed through the map objects array.
 */
export class KitchenTable extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
