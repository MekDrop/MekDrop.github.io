import { AbstractHeroLocomotionState } from "./AbstractHeroLocomotionState.js";
import { HERO_ANIMATION } from "../../../../../enum/HeroAnimation.js";
import { HERO_LOCOMOTION_STATE } from "../../../../../enum/HeroLocomotionState.js";

export const RUN_STOP_DURATION = 0.42;

/**
 * Completes the supporting foot's braking step unless movement or an action interrupts.
 */
export class HeroStoppingLocomotionState extends AbstractHeroLocomotionState {
  /**
   * @type {number}
   */
  #elapsed = 0;
  /**
   * @type {string}
   */
  #animation = HERO_ANIMATION.RUN_STOP_LEFT;

  constructor() {
    super(HERO_LOCOMOTION_STATE.STOPPING, HERO_ANIMATION.RUN_STOP_LEFT);
  }

  get animation() {
    return this.#animation;
  }

  /**
   * @param {import("../../HeroLocomotion.js").HeroLocomotion} owner
   */
  enter(owner) {
    this.#elapsed = 0;
    this.#animation = owner.motion.phase < 0.5 ? HERO_ANIMATION.RUN_STOP_LEFT : HERO_ANIMATION.RUN_STOP_RIGHT;
  }

  /**
   * @param {import("../../HeroLocomotion.js").HeroLocomotion} owner
   */
  execute(owner) {
    if (owner.motion.moving) {
      this.selectGait(owner);

      return;
    }
    this.#elapsed += owner.deltaTime;
    if (this.#elapsed >= RUN_STOP_DURATION) {
      this.selectGait(owner);
    }
  }

  exit() {
    this.#elapsed = 0;
  }
}
