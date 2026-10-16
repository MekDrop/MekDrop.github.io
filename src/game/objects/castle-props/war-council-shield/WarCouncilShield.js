import modelUrl from "../../../models/castle/props/war-council-wall-shield.glb?url";
import { AbstractCastleProp } from "../../shared/AbstractCastleProp.js";

/**
 * Wall-mounted shield and crossed swords.
 */
export class WarCouncilShield extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
