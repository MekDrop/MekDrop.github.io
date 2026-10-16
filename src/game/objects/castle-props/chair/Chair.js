import modelUrl from "../../../models/chair/chair.glb?url";
import { AbstractCastleProp } from "../../shared/AbstractCastleProp.js";

/**
 * Shared wooden chair placed through the map objects array.
 */
export class Chair extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
