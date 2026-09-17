import princessModelUrl from "../../models/castle/royals/princess.glb?url";
import { CastleLeisureSequence } from "./CastleLeisureSequence.js";
import { TerraceActor } from "./TerraceActor.js";

/** Owns the princess model and her terrace-specific pose entry points. */
export class TerracePrincess {
  static get kind() {
    return "princess";
  }

  static get modelUrl() {
    return princessModelUrl;
  }

  #actor;
  #sequence;

  constructor({ pc, modelLibrary }) {
    this.#actor = new TerraceActor({
      pc,
      modelLibrary,
      modelUrl: princessModelUrl,
      kind: TerracePrincess.kind,
    });
    this.#sequence = new CastleLeisureSequence(TerracePrincess.kind);
  }

  get entity() {
    return this.#actor.entity;
  }

  get sequence() {
    return this.#sequence;
  }

  get rightHand() {
    return this.#actor.rightHand;
  }

  get leftHand() {
    return this.#actor.leftHand;
  }

  get head() {
    return this.#actor.head;
  }

  get height() {
    return this.#actor.height;
  }

  pose(action, time = 0, blend = 1) {
    this.#actor.pose(action, time, blend);
  }

  destroy() {
    this.#actor.destroy();
    this.#actor = null;
    this.#sequence = null;
  }
}
