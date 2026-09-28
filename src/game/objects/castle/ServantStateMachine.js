import { State, StateMachine } from "yuka";

/**
 * Context supplied while a servant sequence is updated.
 *
 * @typedef {{doorwayBusy: boolean}} ServantUpdateContext
 */

/**
 * Yuka state machine with game-time updates and resumable interruptions.
 */
export class ServantStateMachine extends StateMachine {
  /**
   *
    * @type {string}
   */
  #idlePhase;
  /**
   *
    * @type {string}
   */
  #initialPhase;
  /**
   *
    * @type {(state: import("./states/servant/AbstractServantState.js").AbstractServantState, context: ServantUpdateContext|null) => boolean}
   */
  #holdState;
  /**
   *
    * @type {number}
   */
  #elapsed = 0;
  /**
   *
    * @type {ServantUpdateContext|null}
   */
  #context;
  /**
   *
    * @type {Array<{phase: string, elapsed: number, context: ServantUpdateContext|null}>}
   */
  #interruptions = [];

  /**
   *
   * @param {{idlePhase: string, initialPhase: string, states: Array<import("./states/servant/AbstractServantState.js").AbstractServantState>, holdState: (state: import("./states/servant/AbstractServantState.js").AbstractServantState, context: ServantUpdateContext|null) => boolean}} options
   * @param {string} options.idlePhase
   * @param {string} options.initialPhase
   * @param {Array<import("./states/servant/AbstractServantState.js").AbstractServantState>} options.states
   * @param {(state: import("./states/servant/AbstractServantState.js").AbstractServantState, context: ServantUpdateContext|null) => boolean} options.holdState
   */
  constructor({ idlePhase, initialPhase, states, holdState = () => false }) {
    super();
    this.owner = this;
    this.#idlePhase = idlePhase;
    this.#initialPhase = initialPhase;
    this.#holdState = holdState;
    this.add(idlePhase, new State());
    for (const state of states) {
      this.add(state.phase, state);
    }
    this.changeTo(idlePhase);
  }

  /**
   *
    * @returns {number}
   */
  get phase() {
    return this.currentState.phase ?? this.#idlePhase;
  }

  /**
   *
    * @returns {boolean}
   */
  get active() {
    return !this.in(this.#idlePhase);
  }

  get elapsed() {
    return this.#elapsed;
  }

  /**
   *
    * @returns {string}
   */
  get action() {
    return this.currentState.action ?? null;
  }

  /**
   *
    * @returns {string|null}
   */
  get animation() {
    return this.currentState.animation ?? null;
  }

  /**
   *
    * @returns {string|null}
   */
  get alignmentAnimation() {
    return this.currentState.alignmentAnimation ?? this.animation;
  }

  /**
   *
    * @returns {string|null}
   */
  get animation() {
    return this.currentState.animation ?? null;
  }

  /**
   *
    * @returns {string|null}
   */
  get alignmentAnimation() {
    return this.currentState.alignmentAnimation ?? this.animation;
  }

  /**
   *
    * @returns {boolean}
   */
  get interrupted() {
    return this.#interruptions.length > 0;
  }

  /**
   *
    * @returns {number}
   */
  get progress() {
    return this.active
      ? Math.min(1, this.#elapsed / this.currentState.duration)
      : 0;
  }

  start() {
    if (this.active) {
      return false;
    }
    this.changeTo(this.#initialPhase);
    this.#elapsed = 0;
    return true;
  }

  /**
   *
   * @param {number} deltaTime
   * @param {ServantUpdateContext|null} context
   */
  update(deltaTime, context = null) {
    if (!this.active || !Number.isFinite(deltaTime) || deltaTime <= 0) {
      return this;
    }
    this.#elapsed += deltaTime;
    this.#context = context;
    while (this.active) {
      const state = this.currentState;
      super.update();
      if (this.currentState === state) {
        break;
      }
    }
    return this;
  }

  /**
   *
   * @param {import("./states/servant/AbstractServantState.js").AbstractServantState} state
   */
  canAdvance(state) {
    if (this.#elapsed < state.duration) {
      return false;
    }
    if (this.#holdState(state, this.#context)) {
      this.#elapsed = state.duration;
      return false;
    }
    return true;
  }

  /**
   *
   * @param {number} duration
   */
  consume(duration) {
    this.#elapsed -= duration;
  }

  /**
   *
   * @param {string} phase
   */
  interrupt(phase) {
    if (!this.active || !this.get(phase)) {
      return false;
    }
    this.#interruptions.push({
      phase: this.phase,
      elapsed: this.#elapsed,
      context: this.#context,
    });
    this.changeTo(phase);
    this.#elapsed = 0;
    this.#context = null;
    return true;
  }

  resume() {
    const interrupted = this.#interruptions.pop();
    if (!interrupted) {
      return false;
    }
    this.changeTo(interrupted.phase);
    this.#elapsed = interrupted.elapsed;
    this.#context = interrupted.context;
    return true;
  }

  reset() {
    this.changeTo(this.#idlePhase);
    this.#elapsed = 0;
    this.#context = null;
    this.#interruptions = [];
  }
}
