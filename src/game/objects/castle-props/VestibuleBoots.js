import modelUrl from "../../models/castle/props/vestibule-boots.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * A pair of muddy boots grounded beneath the waiting bench.
 */
export class VestibuleBoots extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
