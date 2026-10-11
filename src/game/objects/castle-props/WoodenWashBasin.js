import modelUrl from "../../models/castle/props/wooden-wash-basin.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";

/**
 * Hollow stave wash basin with iron hoops and lifting handles.
 */
export class WoodenWashBasin extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
