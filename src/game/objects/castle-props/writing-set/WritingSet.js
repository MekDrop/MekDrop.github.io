import modelUrl from "../../../models/castle/props/court-writing-set.glb?url";
import { AbstractCastleProp } from "../../shared/AbstractCastleProp.js";

/**
 * A small ink pot with its inserted feather quill, seated on a desk.
 */
export class WritingSet extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() {
    return modelUrl;
  }
}
