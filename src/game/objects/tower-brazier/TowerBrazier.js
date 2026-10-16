import modelUrl from "../../models/castle/props/tower-brazier.glb?url";
import { AbstractCastleProp } from "../shared/AbstractCastleProp.js";

/**
 * Authored tower brazier placed through the map objects array.
 */
export class TowerBrazier extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
