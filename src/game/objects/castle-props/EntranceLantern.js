import modelUrl from "../../models/castle/props/entrance-lantern.glb?url";
import { AbstractCastleProp } from "./AbstractCastleProp.js";
import { LanternFire } from "./LanternFire.js";

/**
 * Authored entrance lantern placed through the map objects array.
 */
export class EntranceLantern extends AbstractCastleProp {
  /**
   * @param {ConstructorParameters<typeof AbstractCastleProp>[0]} options
   */
  constructor(options) {
    super(options);
    LanternFire.add(options.pc, this.visualRoots[0].children[0], this.constructor.flamePosition, options.modelLibrary);
  }
  /**
   * Model-local wick position.
   * @returns {{x:number,y:number,z:number}}
   */
  static get flamePosition() { return { x: 0, y: 0.102, z: 0.047 }; }
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
