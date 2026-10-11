import modelUrl from "../../models/castle/leisure/folding-daybed.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Spare terrace equipment stored by the room generator.
 */
export class TerraceSunbed extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
