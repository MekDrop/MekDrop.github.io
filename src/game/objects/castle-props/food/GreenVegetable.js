import modelUrl from "../../../models/food/green-vegetable.glb?url";
import { AbstractCastleProp } from "../../shared/AbstractCastleProp.js";

/**
 * Reusable vegetable, independently placeable or contained by another object.
 */
export class GreenVegetable extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() {
    return modelUrl;
  }
}
