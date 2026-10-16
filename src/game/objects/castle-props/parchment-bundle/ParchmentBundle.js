import modelUrl from "../../../models/castle/props/library-parchment-bundle.glb?url";
import { AbstractCastleProp } from "../../shared/AbstractCastleProp.js";

/**
 * Bound parchment rolls for library shelves and tables.
 */
export class ParchmentBundle extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() {
    return modelUrl;
  }
}
