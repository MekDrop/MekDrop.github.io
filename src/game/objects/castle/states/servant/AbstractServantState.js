import { State } from "yuka";

/**
 * Configurable timed state that can be composed into servant behaviors.
 * @abstract
 */
export class AbstractServantState extends State {
  /**
   *
    * @type {string}
   */
  #phase;
  /**
   *
    * @type {number}
   */
  #duration;
  /**
   *
    * @type {string|null}
   */
  #nextPhase;
  /**
   *
    * @type {string}
   */
  #action;
  /**
   *
    * @type {string}
   */
  #animation;
  /**
   *
    * @type {string}
   */
  #alignmentAnimation;

  /**
   *
   * @param {{phase: number, duration: number, nextPhase: string|null, action: string, animation: string, alignmentAnimation: string}} options
   * @param {number} options.phase
   * @param {number} options.duration
   * @param {string|null} options.nextPhase
   * @param {string} options.action
   * @param {string} options.animation
   * @param {string} options.alignmentAnimation
   */
  constructor({
    phase,
    duration,
    nextPhase,
    action,
    animation,
    alignmentAnimation = animation,
  }) {
    super();
    this.#phase = phase;
    this.#duration = duration;
    this.#nextPhase = nextPhase;
    this.#action = action;
    this.#animation = animation;
    this.#alignmentAnimation = alignmentAnimation;
  }

  get phase() {
    return this.#phase;
  }

  get duration() {
    return this.#duration;
  }

  get nextPhase() {
    return this.#nextPhase;
  }

  get action() {
    return this.#action;
  }

  get animation() {
    return this.#animation;
  }

  get alignmentAnimation() {
    return this.#alignmentAnimation;
  }

  /**
   *
   * @param {import("../../ServantStateMachine.js").ServantStateMachine} owner
   */
  execute(owner) {
    if (!owner.canAdvance(this)) {
      return;
    }
    owner.consume(this.duration);
    if (this.nextPhase === null && owner.resume()) {
      return;
    }
    owner.changeTo(this.nextPhase);
  }
}
