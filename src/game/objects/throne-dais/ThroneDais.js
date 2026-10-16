import modelUrl from "../../models/castle/props/throne-dais.glb?url";
import { AbstractCastleProp } from "../shared/AbstractCastleProp.js";

/**
 * A single low step supporting the throne.
 */
export class ThroneDais extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
