import modelUrl from "../../models/castle/leisure/open-book.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Spare terrace equipment stored by the room generator.
 */
export class TerraceReadingBook extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
