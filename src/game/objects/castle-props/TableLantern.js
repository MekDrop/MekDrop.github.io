import modelUrl from "../../models/castle/props/table-lantern.glb?url";
import { EntranceLantern } from "./EntranceLantern.js";

/**
 * Portable lantern with a flat base and carrying ring, without a wall bracket.
 */
export class TableLantern extends EntranceLantern {
  /**
   * @param {ConstructorParameters<typeof EntranceLantern>[0]} options
   */
  constructor(options) {
    super(options);
    const light = new options.pc.Entity("Table lantern warm light");
    light.setLocalPosition(0, 0.15, 0);
    light.addComponent("light", { type: "omni", color: new options.pc.Color(1, 0.65, 0.28),
      intensity: 1.2, range: 2.4, castShadows: false });
    this.visualRoots[0].children[0].addChild(light);
  }
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
  /**
   * Centre of the portable lantern's candle top.
   * @returns {{x:number,y:number,z:number}}
   */
  static get flamePosition() { return { x: 0, y: 0.11, z: 0 }; }
}
