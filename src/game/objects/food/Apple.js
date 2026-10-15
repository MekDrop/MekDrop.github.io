import modelUrl from "../../models/food/apple.glb?url";
import { AbstractCastleProp } from "../castle-props/AbstractCastleProp.js";

/**
 * Reusable apple, independently placeable or contained by another object.
 */
export class Apple extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
