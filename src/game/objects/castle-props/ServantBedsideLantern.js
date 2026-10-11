import { EntranceLantern } from "./EntranceLantern.js";

/**
 * A low bedside lamp that lights the bedding, drawer top and nearby masonry.
 */
export class ServantBedsideLantern extends EntranceLantern {
  /**
   * @param {ConstructorParameters<typeof EntranceLantern>[0]} options
   */
  constructor(options) {
    super(options);
    const light = new options.pc.Entity("Servant bedside warm light");
    light.setLocalPosition(0, 0.29, 0.18);
    light.addComponent("light", { type: "omni", color: new options.pc.Color(1, 0.62, 0.25),
      intensity: 1.5, range: 2.4, castShadows: false });
    this.visualRoots[0].addChild(light);
  }
}
