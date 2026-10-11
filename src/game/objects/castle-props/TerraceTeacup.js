import modelUrl from "../../models/castle/leisure/teacup.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Spare terrace equipment stored by the room generator.
 */
export class TerraceTeacup extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
