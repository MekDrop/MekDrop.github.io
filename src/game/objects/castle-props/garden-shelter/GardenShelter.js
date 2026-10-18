import pergolaUrl from "../../../models/castle/garden/pergola.glb?url";
import canopyUrl from "../../../models/castle/garden/striped-canopy.glb?url";
import { AbstractCastleProp } from "../../shared/AbstractCastleProp.js";

/**
 * Open-sided timber shelter. Both authored meshes have bottom-centre pivots,
 * a 4.2 × 3.62 m maximum footprint and 2.85 m height. Posts leave seating open.
 */
export class GardenShelter extends AbstractCastleProp {
  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [pergolaUrl, canopyUrl];
  }

  /**
   * @returns {string}
   */
  get modelUrl() {
    return this.definition.variant === "canopy" ? canopyUrl : pergolaUrl;
  }
}
