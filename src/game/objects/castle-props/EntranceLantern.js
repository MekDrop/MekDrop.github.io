import modelUrl from "../../models/castle/props/entrance-lantern.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Authored entrance lantern placed through the map objects array.
 */
export class EntranceLantern extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
