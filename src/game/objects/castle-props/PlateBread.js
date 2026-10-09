import modelUrl from "../../models/castle/props/plate-bread.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Authored plate bread placed through the map objects array.
 */
export class PlateBread extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
