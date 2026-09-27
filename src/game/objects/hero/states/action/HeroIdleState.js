import { AbstractHeroActionState } from "./AbstractHeroActionState.js";

export class HeroIdleState extends AbstractHeroActionState {
  #duration;

  constructor(action, animation, duration = 0) {
    super(action, animation);
    this.#duration = duration;
  }

  enter(owner) {
    owner.remaining = this.#duration || owner.idleDuration;
  }

  execute(owner) {
    owner.remaining = Math.max(0, owner.remaining - owner.deltaTime);
    if (owner.remaining === 0) {
      owner.complete();
    }
  }
}
