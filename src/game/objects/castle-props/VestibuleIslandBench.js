import modelUrl from "../../models/castle/props/vestibule-island-bench.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Freestanding Tripo-authored double-sided upholstered arrival bench.
 */
export class VestibuleIslandBench extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
