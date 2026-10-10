import modelUrl from "../../models/castle/props/table-candles.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";
import { CandleFire } from "./CandleFire.js";

/**
 * Authored table candles placed through the map objects array.
 */
export class TableCandles extends AbstractCastleProp {
  /**
   * @param {ConstructorParameters<typeof AbstractCastleProp>[0]} options
   */
  constructor(options) {
    super(options);
    CandleFire.add(options.pc, this.visualRoots[0].children[0], options.modelLibrary, 0.023);
  }

  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
