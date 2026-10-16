import wallModelUrl from "../../models/castle/props/vestibule-bench.glb?url";
import islandModelUrl from "../../models/castle/props/vestibule-island-bench.glb?url";
import { AbstractCastleProp } from "../castle-props/AbstractCastleProp.js";

/**
 * Independent seating with wall and freestanding island model variants.
 */
export class Bench extends AbstractCastleProp {
  /**
   * @returns {string[]}
   */
  static get modelUrls() { return [wallModelUrl, islandModelUrl]; }

  /**
   * Rendering and authored collision always use the same selected asset.
   * @returns {string}
   */
  get modelUrl() {
    return this.definition.variant === "island" ? islandModelUrl : wallModelUrl;
  }
}
