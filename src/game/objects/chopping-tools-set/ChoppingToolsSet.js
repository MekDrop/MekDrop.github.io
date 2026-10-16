import modelUrl from "../../models/castle/props/chopping-tools-set.glb?url";
import { AbstractCastleProp } from "../shared/AbstractCastleProp.js";

/**
 * Grounded board, knife and stirring spoon for kitchen preparation.
 */
export class ChoppingToolsSet extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
