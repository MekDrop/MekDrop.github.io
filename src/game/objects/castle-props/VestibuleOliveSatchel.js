import modelUrl from "../../models/castle/props/vestibule-olive-satchel.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Olive luggage companion for the arrival bench.
 */
export class VestibuleOliveSatchel extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
