import roofUrl from "../../models/castle/residential/blue-roof.glb?url";

/**
 * Places the authored tiled roof module on each generated roof footprint.
 */
export class CastleRoof {
  /**
   * @returns {string}
   */
  static get modelUrl() { return roofUrl; }
  /**
   * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   * @type {import("../../models/GameModelLibrary.js").GameModelLibrary}
   */
  #modelLibrary;
  /**
   * @param {{pc: typeof import("playcanvas"), modelLibrary: import("../../models/GameModelLibrary.js").GameModelLibrary}} options
   */
  constructor({ pc, modelLibrary }) {
    this.#entity = new pc.Entity("Authored castle roofs");
    this.#modelLibrary = modelLibrary;
  }
  get entity() { return this.#entity; }
  /**
   * @param {{x: number, y: number, z: number, yaw?: number, width?: number, depth?: number, height?: number}} options
   */
  add({ x, y, z, yaw = 0, width = 1.4, depth = 1.4, height = 0.9 }) {
    const roof = this.#modelLibrary.instantiate(roofUrl);
    roof.name = "Blender tiled blue roof";
    roof.setLocalPosition(x, y, z);
    roof.setLocalEulerAngles(0, yaw, 0);
    roof.setLocalScale(width, height, depth);
    this.#entity.addChild(roof);
  }
  destroy() { this.#entity.destroy(); }
}
