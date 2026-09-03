import kingModelUrl from "../../models/castle/royals/king.glb?url";
import princessModelUrl from "../../models/castle/royals/princess.glb?url";
import queenModelUrl from "../../models/castle/royals/queen.glb?url";

const MODEL_BY_ROLE = Object.freeze({
  king: kingModelUrl,
  queen: queenModelUrl,
  princess: princessModelUrl,
});

/** An imported seated royal whose local +Z axis faces the visitor. */
export class SeatedRoyal {
  static get modelUrls() {
    return Object.values(MODEL_BY_ROLE);
  }

  #entity;

  constructor({ role = "king", modelLibrary }) {
    const normalizedRole = MODEL_BY_ROLE[role] ? role : "king";
    this.#entity = modelLibrary.instantiate(MODEL_BY_ROLE[normalizedRole]);
    this.#entity.name = `Seated ${normalizedRole}`;
  }

  get entity() {
    return this.#entity;
  }

  destroy() {
    this.#entity?.destroy();
    this.#entity = null;
  }
}
