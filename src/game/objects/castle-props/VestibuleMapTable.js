import modelUrl from "../../models/castle/props/vestibule-map-table.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Tripo-authored arrival map table with parchment and wooden route markers.
 */
export class VestibuleMapTable extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
