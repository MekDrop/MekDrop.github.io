import modelUrl from "../../models/castle/props/floor-candelabrum.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";
import { Fire } from "../fire/Fire.js";

/**
 * Authored floor candelabrum placed through the map objects array.
 */
export class FloorCandelabrum extends AbstractCastleProp {
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
        x: 0.0225,
        y: 0.162,
        z: 0.0225,
      });
    }
  }

  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
