import modelUrl from "../../models/castle/leisure/teapot.glb?url";
import { AbstractCastleProp } from "../shared/AbstractCastleProp.js";

/**
 * Reusable teapot placed through the map objects array.
 */
export class Teapot extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
