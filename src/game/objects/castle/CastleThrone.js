import throneModelUrl from "../../models/castle/throne/throne.glb?url";

export class CastleThrone {
  static get modelUrl() {
    return throneModelUrl;
  }

  #entity;

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
