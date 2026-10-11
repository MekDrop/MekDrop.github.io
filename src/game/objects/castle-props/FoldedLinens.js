import modelUrl from "../../models/castle/props/folded-linens.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Grounded stack of cream and blue folded household linens.
 */
export class FoldedLinens extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
