import modelUrl from "../../models/castle/props/wooden-storage-chest.glb?url";
import { AbstractCastleProp } from "../castle-props/AbstractCastleProp.js";

/**
 * Low plank-built chest with authored lid, braces, fittings and mesh collision.
 */
export class Chest extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
