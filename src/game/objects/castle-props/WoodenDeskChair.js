import modelUrl from "../../models/castle/props/wooden-desk-chair.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Authored wooden desk chair placed through the map objects array.
 */
export class WoodenDeskChair extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
