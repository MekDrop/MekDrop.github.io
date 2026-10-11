import modelUrl from "../../models/castle/leisure/teapot.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Spare terrace equipment stored by the room generator.
 */
export class TerraceTeapot extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
