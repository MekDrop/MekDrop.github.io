import modelUrl from "../../models/castle/props/bowl-green-vegetables.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Authored bowl green vegetables placed through the map objects array.
 */
export class BowlGreenVegetables extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
