import throneModelUrl from "../../models/castle/props/blue-armchair.glb?url";
import { addAuthoredMeshPhysics } from "../shared/AuthoredMeshPhysics.js";

export class CastleThrone {
  /**
   *
    * @returns {string}
   */
  static get modelUrl() {
    return throneModelUrl;
  }

  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   * @type {import("playcanvas").Entity}
   */
  #collisionGraph;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), modelLibrary: import("../../models/GameModelLibrary.js").GameModelLibrary}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {string} options.modelLibrary
   */
  constructor({ pc, modelLibrary }) {
    this.#entity = modelLibrary.instantiate(CastleThrone.modelUrl);
    this.#entity.name = "Throne";
    this.#collisionGraph = modelLibrary.instantiate(CastleThrone.modelUrl);
    addAuthoredMeshPhysics(pc, this.#entity, this.#collisionGraph);
  }

  get entity() {
    return this.#entity;
  }

  destroy() {
    this.#entity?.destroy();
    this.#collisionGraph?.destroy();
    this.#entity = null;
  }
}
