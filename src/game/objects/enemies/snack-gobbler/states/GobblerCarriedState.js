import { State } from "yuka";

export class GobblerCarriedState extends State {
  /**
   * @type {number}
   */
  #nextBite = 0;
  /**
   * @type {number}
   */
  #biteUntil = 0;

  /**
   * @param {import("../SnackGobbler.js").SnackGobbler} owner
   */
  enter(owner) {
    this.#nextBite = owner.elapsed + 0.5;
    this.#biteUntil = 0;
    owner.requestClip("carried_struggle");
  }

  /**
   * @param {import("../SnackGobbler.js").SnackGobbler} owner
   */
  execute(owner) {
    if (owner.carrier && owner.elapsed >= this.#nextBite) {
      this.#nextBite = owner.elapsed + 1.25;
      this.#biteUntil = owner.elapsed + 0.3;
      owner.requestClip("carried_bite");
      owner.carrier.receiveDamage?.(8, owner, "carried_bite");
    } else if (owner.elapsed >= this.#biteUntil) {
      owner.requestClip("carried_struggle");
    }
  }
}
