import modelUrl from "../../../models/castle/leisure/teacup.glb?url";
import { AbstractCastleProp } from "../../shared/AbstractCastleProp.js";

/**
 * Reusable teacup placed through the map objects array.
 */
export class Teacup extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
