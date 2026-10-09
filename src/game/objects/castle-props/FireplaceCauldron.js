import modelUrl from "../../models/castle/props/fireplace-cauldron.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Authored fireplace cauldron placed through the map objects array.
 */
export class FireplaceCauldron extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
