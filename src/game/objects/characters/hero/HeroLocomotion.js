import { StateMachine } from "yuka";
import { HERO_LOCOMOTION_STATE } from "../../../enum/HeroLocomotionState.js";
import { HeroIdleLocomotionState } from "./states/locomotion/HeroIdleLocomotionState.js";
import { HeroWalkingLocomotionState } from "./states/locomotion/HeroWalkingLocomotionState.js";
import { HeroAcceleratingLocomotionState } from "./states/locomotion/HeroAcceleratingLocomotionState.js";
import { HeroRunningLocomotionState } from "./states/locomotion/HeroRunningLocomotionState.js";
import { HeroSlowingLocomotionState } from "./states/locomotion/HeroSlowingLocomotionState.js";
import { HeroStoppingLocomotionState } from "./states/locomotion/HeroStoppingLocomotionState.js";

/**
 * @typedef {{enabled:boolean,moving:boolean,running:boolean,speed:number,walkSpeed:number,runSpeed:number,phase:number}} HeroLocomotionMotion
 */

/**
 * Independent Yuka ground-gait layer alongside the hero's action and emotion states.
 */
export class HeroLocomotion {
  /**
   * @type {StateMachine}
   */
  #stateMachine;
  /**
   * @type {Map<string, import("./states/locomotion/AbstractHeroLocomotionState.js").AbstractHeroLocomotionState>}
   */
  #states = new Map();
  /**
   * @type {HeroLocomotionMotion|null}
   */
  #motion = null;
  /**
   * @type {number}
   */
  #deltaTime = 0;

  constructor() {
    this.#stateMachine = new StateMachine(this);
    for (const state of [
      new HeroIdleLocomotionState(),
      new HeroWalkingLocomotionState(),
      new HeroAcceleratingLocomotionState(),
      new HeroRunningLocomotionState(),
      new HeroSlowingLocomotionState(),
      new HeroStoppingLocomotionState(),
    ]) {
      this.#states.set(state.kind, state);
      this.#stateMachine.add(state.constructor.name, state);
    }
    this.reset();
  }

  /**
   * @returns {import("./states/locomotion/AbstractHeroLocomotionState.js").AbstractHeroLocomotionState}
   */
  get currentState() {
    return this.#stateMachine.currentState;
  }

  /**
   * @returns {string}
   */
  get state() {
    return this.currentState.kind;
  }

  get motion() {
    return this.#motion;
  }

  get deltaTime() {
    return this.#deltaTime;
  }

  /**
   * @returns {boolean}
   */
  get running() {
    return this.currentState.running;
  }

  /**
   * @returns {boolean}
   */
  get stopping() {
    return this.currentState instanceof HeroStoppingLocomotionState;
  }

  reset() {
    this.changeState(HERO_LOCOMOTION_STATE.IDLE);
    this.#motion = null;
    this.#deltaTime = 0;
  }

  /**
   * @param {string} kind
   */
  changeState(kind) {
    const next = this.#states.get(kind);
    if (this.currentState !== next) {
      this.#stateMachine.changeTo(next.constructor.name);
    }
  }

  updateState() {
    this.#stateMachine.update();
  }

  /**
   * @param {number} deltaTime
   * @param {HeroLocomotionMotion} motion
   * @returns {string|null}
   */
  update(deltaTime, motion) {
    if (!motion.enabled) {
      this.reset();

      return null;
    }
    this.#motion = motion;
    this.#deltaTime = deltaTime;
    this.updateState();

    return this.currentState.animation;
  }
}
