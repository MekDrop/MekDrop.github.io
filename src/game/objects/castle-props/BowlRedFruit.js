import modelUrl from "../../models/castle/props/bowl-red-fruit.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Authored bowl red fruit placed through the map objects array.
 */
export class BowlRedFruit extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
