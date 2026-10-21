import { State } from "yuka";
import { HERO_LOCOMOTION_STATE } from "../../../../../enum/HeroLocomotionState.js";

/**
 * Shared speed thresholds for ground gaits; actions suspend this state layer.
 * @abstract
 */
export class AbstractHeroLocomotionState extends State {
  /**
   * @type {string}
   */
  #kind;
  /**
   * @type {string}
   */
  #animation;
  /**
   * @type {boolean}
   */
  #running;

  /**
   * @param {string} kind
   * @param {string} animation
   * @param {boolean} [running]
   */
  constructor(kind, animation, running = false) {
    super();

    this.#kind = kind;
    this.#animation = animation;
    this.#running = running;
  }

  get kind() {
    return this.#kind;
  }

  get animation() {
    return this.#animation;
  }

  get running() {
    return this.#running;
  }

  /**
   * @param {import("../../HeroLocomotion.js").HeroLocomotion} owner
   */
  execute(owner) {
    if (!owner.motion.moving && this.running) {
      owner.changeState(HERO_LOCOMOTION_STATE.STOPPING);
      owner.updateState();

      return;
    }
    this.selectGait(owner);
  }

  /**
   * @param {import("../../HeroLocomotion.js").HeroLocomotion} owner
   */
  selectGait(owner) {
    const { speed, walkSpeed, runSpeed, running } = owner.motion;
    if (speed <= 0.08) {
      owner.changeState(HERO_LOCOMOTION_STATE.IDLE);
    } else if (speed <= walkSpeed * 1.08) {
      owner.changeState(HERO_LOCOMOTION_STATE.WALKING);
    } else if (!running) {
      owner.changeState(HERO_LOCOMOTION_STATE.SLOWING);
    } else if (speed < runSpeed * 0.95) {
      owner.changeState(HERO_LOCOMOTION_STATE.ACCELERATING);
    } else {
      owner.changeState(HERO_LOCOMOTION_STATE.RUNNING);
    }
  }
}
