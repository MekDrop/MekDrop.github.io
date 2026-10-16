import modelUrl from "../../../models/castle/props/wooden-barrel.glb?url";
import { AbstractCastleProp } from "../../shared/AbstractCastleProp.js";

/**
 * Reusable barrel placed through the map objects array.
 */
export class Barrel extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() {
    return modelUrl;
  }
}
