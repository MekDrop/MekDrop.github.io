import modelUrl from "../../models/castle/props/table-candles.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";
import { Fire } from "../fire/Fire.js";

/**
 * Authored table candles placed through the map objects array.
 */
export class TableCandles extends AbstractCastleProp {
  /**
   * @param {ConstructorParameters<typeof AbstractCastleProp>[0]} options
   */
  constructor(options) {
    super(options);

    const model = this.visualRoots[0].children[0];
    const inverse = model.getWorldTransform().clone().invert();
    for (const name of ["Tall candle wick", "Middle candle wick", "Short candle wick"]) {
      const position = inverse.transformPoint(model.findByName(name).getPosition());
      Fire.attach(options.pc, model, position, {
        x: 0.0115,
        y: 0.0828,
        z: 0.0115,
      });
    }
  }

  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
