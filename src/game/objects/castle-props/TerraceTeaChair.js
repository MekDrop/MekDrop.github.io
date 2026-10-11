import modelUrl from "../../models/castle/leisure/tea-chair.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Spare terrace equipment stored by the room generator.
 */
export class TerraceTeaChair extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
