import modelUrl from "../../models/castle/props/compact-spear-rack.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Narrow freestanding rack for three spears.
 */
export class SpearRack extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
