import modelUrl from "../../models/castle/props/library-book-stack.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Three touching leather-bound books for library shelves and tables.
 */
export class LibraryBookStack extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
