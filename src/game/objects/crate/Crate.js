import modelUrl from "../../models/castle/props/wooden-crate.glb?url";
import { AbstractCastleProp } from "../castle-props/AbstractCastleProp.js";

/**
 * Reusable crate placed through the map objects array.
 */
export class Crate extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
