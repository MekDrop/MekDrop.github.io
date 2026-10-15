import modelUrl from "../../models/castle/props/vestibule-travel-kit.glb?url";
import { AbstractCastleProp } from "../castle-props/AbstractCastleProp.js";

/**
 * Leather luggage and its strapped wool bedroll.
 */
export class TravelKit extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
