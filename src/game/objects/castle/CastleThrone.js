import throneModelUrl from "../../models/castle/throne/throne.glb?url";

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
   *
   * @param {{modelLibrary: string}} options
   * @param {string} options.modelLibrary
   */
  constructor({ modelLibrary }) {
    this.#entity = modelLibrary.instantiate(CastleThrone.modelUrl);
    this.#entity.name = "Throne";
  }

  get entity() {
    return this.#entity;
  }

  destroy() {
    this.#entity?.destroy();
    this.#entity = null;
  }
}
