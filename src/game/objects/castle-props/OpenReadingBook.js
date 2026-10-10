import modelUrl from "../../models/castle/props/open-reading-book.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Open parchment volume with an authored bottom-center desk pivot.
 */
export class OpenReadingBook extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
