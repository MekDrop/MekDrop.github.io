import modelUrl from "../../models/castle/props/closed-reading-book.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Horizontal closed book for library desks and side tables.
 */
export class ClosedReadingBook extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
