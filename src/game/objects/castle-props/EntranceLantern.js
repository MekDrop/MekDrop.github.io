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
    LanternFire.add(options.pc, this.visualRoots[0].children[0], undefined, options.modelLibrary);
  }
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
}
