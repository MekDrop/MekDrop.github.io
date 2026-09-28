import { AbstractHeroActionState } from "./AbstractHeroActionState.js";

export class HeroIdleState extends AbstractHeroActionState {
  /**
   *
    * @type {number}
   */
  #duration;

  /**
   *
   * @param {string} action
   * @param {string|number} animation
   * @param {number} duration
   */
  constructor(action, animation, duration = 0) {
    super(action, animation);
    this.#duration = duration;
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  enter(owner) {
    owner.remaining = this.#duration || owner.idleDuration;
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  execute(owner) {
    owner.remaining = Math.max(0, owner.remaining - owner.deltaTime);
    if (owner.remaining === 0) {
      owner.complete();
    }
  }
}
