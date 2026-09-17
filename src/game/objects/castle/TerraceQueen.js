import queenModelUrl from "../../models/castle/royals/queen.glb?url";
import { CastleLeisureSequence } from "./CastleLeisureSequence.js";
import { TerraceActor } from "./TerraceActor.js";

/** Owns the queen model and her terrace-specific pose entry points. */
export class TerraceQueen {
  static get kind() {
    return "queen";
  }

  static get modelUrl() {
    return queenModelUrl;
  }

  #actor;
  #sequence;

  constructor({ pc, modelLibrary }) {
    this.#actor = new TerraceActor({
      pc,
      modelLibrary,
      modelUrl: queenModelUrl,
      kind: TerraceQueen.kind,
    });
    this.#sequence = new CastleLeisureSequence(TerraceQueen.kind);
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
