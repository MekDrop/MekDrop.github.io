import modelUrl from "../../models/castle/leisure/tea-table.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Outdoor pedestal table, owned by the generated leisure group.
 */
export class TeaTable extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
