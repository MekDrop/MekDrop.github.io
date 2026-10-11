import modelUrl from "../../models/castle/props/vestibule-armor-display.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * An empty suit of armor on its authored wooden display base.
 */
export class VestibuleArmorDisplay extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
