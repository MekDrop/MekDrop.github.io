import modelUrl from "../../models/castle/props/library-step-stool.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Two-step oak stool for reaching library shelves.
 */
export class LibraryStepStool extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
