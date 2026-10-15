import modelUrl from "../../models/castle/props/library-step-stool.glb?url";
import { AbstractCastleProp } from "../castle-props/AbstractCastleProp.js";

/**
 * Independent two-step oak stool with authored mesh collision.
 */
export class StepStool extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
