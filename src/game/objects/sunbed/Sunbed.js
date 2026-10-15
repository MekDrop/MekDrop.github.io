import modelUrl from "../../models/castle/leisure/folding-daybed.glb?url";
import { AbstractCastleProp } from "../castle-props/AbstractCastleProp.js";

/**
 * Reusable sunbed placed through the map objects array.
 */
export class Sunbed extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
