import modelUrl from "../../models/food/bread.glb?url";
import { AbstractCastleProp } from "../shared/AbstractCastleProp.js";

/**
 * Reusable bread roll, independently placeable or packed into a bowl.
 */
export class Bread extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
