import modelUrl from "../../models/castle/props/library-side-table.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Small oak table for books beside a library reading chair.
 */
export class LibrarySideTable extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
