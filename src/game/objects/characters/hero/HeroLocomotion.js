import { HERO_ANIMATION } from "../../../enum/HeroAnimation.js";
import { HERO_LOCOMOTION_STATE } from "../../../enum/HeroLocomotionState.js";

export const RUN_STOP_DURATION = 0.42;

/**
 * Selects ground gait from actual speed, retaining a complete braking step.
 */
export class HeroLocomotion {
  /**
   * @type {string}
   */
  #state = HERO_LOCOMOTION_STATE.IDLE;
  /**
   * @type {number}
   */
  #stopElapsed = 0;
  /**
   * @type {string}
   */
  #stopAnimation = HERO_ANIMATION.RUN_STOP_LEFT;

  get state() {
    return this.#state;
  }

  /**
   * @returns {boolean}
   */
  get running() {
    return [HERO_LOCOMOTION_STATE.ACCELERATING, HERO_LOCOMOTION_STATE.RUNNING,
      HERO_LOCOMOTION_STATE.SLOWING].includes(this.#state);
  }

  /**
   * @returns {boolean}
   */
  get stopping() {
    return this.#state === HERO_LOCOMOTION_STATE.STOPPING;
  }

  reset() {
    this.#state = HERO_LOCOMOTION_STATE.IDLE;
    this.#stopElapsed = 0;
  }

  /**
   * @param {number} deltaTime
   * @param {{enabled:boolean,moving:boolean,running:boolean,speed:number,walkSpeed:number,runSpeed:number,phase:number}} motion
   * @returns {string|null}
   */
  update(deltaTime, { enabled, moving, running, speed, walkSpeed, runSpeed, phase }) {
    if (!enabled) {
      this.reset();

      return null;
    }
    if (!moving && this.running) {
      this.#state = HERO_LOCOMOTION_STATE.STOPPING;
      this.#stopElapsed = 0;
      this.#stopAnimation = phase < 0.5 ? HERO_ANIMATION.RUN_STOP_LEFT : HERO_ANIMATION.RUN_STOP_RIGHT;
    }
    if (!moving && this.#state === HERO_LOCOMOTION_STATE.STOPPING) {
      this.#stopElapsed += deltaTime;
      if (this.#stopElapsed < RUN_STOP_DURATION) {
        return this.#stopAnimation;
      }
    }
    this.#stopElapsed = 0;
    if (speed <= 0.08) {
      this.#state = HERO_LOCOMOTION_STATE.IDLE;

      return HERO_ANIMATION.IDLE;
    }
    if (speed > walkSpeed * 1.08) {
      this.#state = !running ? HERO_LOCOMOTION_STATE.SLOWING
        : speed < runSpeed * 0.95 ? HERO_LOCOMOTION_STATE.ACCELERATING : HERO_LOCOMOTION_STATE.RUNNING;

      return HERO_ANIMATION.RUN;
    }
    this.#state = HERO_LOCOMOTION_STATE.WALKING;

    return HERO_ANIMATION.WALK;
  }
}
