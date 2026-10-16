import modelUrl from "../../models/castle/props/court-lectern.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Compact clerk's lectern authored from the game-style reference.
 */
export class Lectern extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }

}
