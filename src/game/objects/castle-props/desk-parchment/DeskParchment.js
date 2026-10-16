import modelUrl from "../../../models/castle/props/desk-parchment.glb?url";
import { AbstractCastleProp } from "../../shared/AbstractCastleProp.js";

/**
 * Authored desk parchment placed through the map objects array.
 */
export class DeskParchment extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
