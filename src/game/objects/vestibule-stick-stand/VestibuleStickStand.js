import modelUrl from "../../models/castle/props/vestibule-stick-stand.glb?url";
import { AbstractCastleProp } from "../shared/AbstractCastleProp.js";

/**
 * Walking sticks and a folded umbrella in an oak holder.
 */
export class VestibuleStickStand extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
