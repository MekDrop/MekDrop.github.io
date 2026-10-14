import modelUrl from "../../models/castle/props/vestibule-brown-satchel.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Broad leather luggage without a bedroll.
 */
export class VestibuleBrownSatchel extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
