import modelUrl from "../../models/castle/residential/terrace-planter.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Boxwood in a stone planter, placed through the room's map objects.
 */
export class TerracePlanter extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
