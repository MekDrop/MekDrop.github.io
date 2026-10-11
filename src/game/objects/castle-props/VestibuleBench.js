import modelUrl from "../../models/castle/props/vestibule-bench.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Tripo-authored oak waiting bench.
 */
export class VestibuleBench extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
