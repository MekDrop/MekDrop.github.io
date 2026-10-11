import { EntranceLantern } from "./EntranceLantern.js";

/**
 * Existing bronze lantern with a warm light carried by its island-owned root.
 */
export class VestibuleLantern extends EntranceLantern {
  /**
   * @param {ConstructorParameters<typeof EntranceLantern>[0]} options
   */
  constructor(options) {
    super(options);
    const light = new options.pc.Entity("Vestibule warm lantern light");
    light.setLocalPosition(0, 0.23, 0.17);
    light.addComponent("light", { type: "omni", color: new options.pc.Color(1, 0.67, 0.3),
      intensity: 0.65, range: 3, castShadows: false });
    this.visualRoots[0].addChild(light);
  }
}
