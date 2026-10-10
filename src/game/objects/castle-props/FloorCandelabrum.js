import modelUrl from "../../models/castle/props/floor-candelabrum.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";
import { CandleFire } from "./CandleFire.js";

/**
 * Authored floor candelabrum placed through the map objects array.
 */
export class FloorCandelabrum extends AbstractCastleProp {
  /**
   * @param {ConstructorParameters<typeof AbstractCastleProp>[0]} options
   */
  constructor(options) {
    super(options);
    CandleFire.add(options.pc, this.visualRoots[0].children[0], options.modelLibrary, 0.045);
  }

  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
