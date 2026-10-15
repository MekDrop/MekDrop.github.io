import modelUrl from "../../models/castle/leisure/teapot.glb?url";
import { AbstractCastleProp } from "../castle-props/AbstractCastleProp.js";

/**
 * Reusable teapot placed through the map objects array.
 */
export class Teapot extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
