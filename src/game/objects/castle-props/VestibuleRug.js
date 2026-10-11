import modelUrl from "../../models/castle/props/vestibule-runner.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Crimson runner with repeated gold embroidery matching the arrival-room concept.
 */
export class VestibuleRug extends AbstractCastleProp {
  /**
   * Cloth must not obstruct the doors' Ammo contact queries.
   * @returns {boolean}
   */
  static get hasAuthoredCollision() { return false; }
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
