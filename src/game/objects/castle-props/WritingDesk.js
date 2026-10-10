import modelUrl from "../../models/castle/residential/writing-desk.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Existing grounded desk, with room-authored paper replacing its baked decoration.
 */
export class WritingDesk extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
  /**
   * @returns {string[]}
   */
  static get omittedModelNodes() { return ["Parchment", "Ink pot"]; }
}
