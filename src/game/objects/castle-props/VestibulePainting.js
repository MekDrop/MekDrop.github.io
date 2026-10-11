import modelUrl from "../../models/castle/props/vestibule-painting.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Tripo-authored framed castle landscape.
 */
export class VestibulePainting extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
