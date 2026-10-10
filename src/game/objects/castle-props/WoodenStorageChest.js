import modelUrl from "../../models/castle/props/wooden-storage-chest.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Low plank-built storage chest with its own lid, braces and iron fittings.
 */
export class WoodenStorageChest extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
