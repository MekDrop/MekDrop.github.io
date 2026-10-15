import modelUrl from "../../models/castle/props/desk-globe.glb?url";
import { AbstractCastleProp } from "../castle-props/AbstractCastleProp.js";

/**
 * Authored desk globe placed through the map objects array.
 */
export class DeskGlobe extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
