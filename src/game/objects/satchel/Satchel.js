import brownModelUrl from "../../models/castle/props/vestibule-brown-satchel.glb?url";
import oliveModelUrl from "../../models/castle/props/vestibule-olive-satchel.glb?url";
import { AbstractCastleProp } from "../castle-props/AbstractCastleProp.js";

/**
 * Freestanding leather luggage with authored brown and olive finishes.
 */
export class Satchel extends AbstractCastleProp {
  /**
   * @returns {string[]}
   */
  static get modelUrls() { return [brownModelUrl, oliveModelUrl]; }

  /**
   * Both the visible mesh and its contact shape use the selected artwork.
   * @returns {string}
   */
  get modelUrl() {
    return this.definition.variant === "olive"
      ? oliveModelUrl : brownModelUrl;
  }
}
