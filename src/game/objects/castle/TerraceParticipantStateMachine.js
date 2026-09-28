import { StateMachine } from "yuka";

/**
 * Game-time Yuka machine shared by individual terrace participants.
 * @abstract
 */
export class TerraceParticipantStateMachine extends StateMachine {
  /**
   *
    * @type {string}
   */
  #dormantPhase;
  /**
   *
    * @type {number}
   */
  #elapsed = 0;
  /**
   *
    * @type {Array<{phase: string, elapsed: number}>}
   */
  #interruptions = [];
  /**
   *
    * @type {{enter?: (state: import("./states/terrace/AbstractTerraceParticipantState.js").AbstractTerraceParticipantState, machine: TerraceParticipantStateMachine) => void, update?: (state: import("./states/terrace/AbstractTerraceParticipantState.js").AbstractTerraceParticipantState, machine: TerraceParticipantStateMachine) => void, exit?: (state: import("./states/terrace/AbstractTerraceParticipantState.js").AbstractTerraceParticipantState, machine: TerraceParticipantStateMachine) => void}|null}
   */
  #actionHandler = null;

  /**
   *
   * @param {{dormantPhase: string, states: Array<import("yuka").State>}} options
   * @param {string} options.dormantPhase
   * @param {Array<import("yuka").State>} options.states
   */
  constructor({ dormantPhase, states }) {
    super();
    this.owner = this;
    this.#dormantPhase = dormantPhase;
    for (const state of states) {
      this.add(state.phase, state);
    }
    this.changeTo(dormantPhase);
  }

  /**
   *
    * @returns {number}
   */
  get phase() {
    return this.currentState.phase;
  }

  /**
   *
    * @returns {string}
   */
  get stagePhase() {
    return this.currentState.stagePhase;
  }

  get elapsed() {
    return this.#elapsed;
  }

  /**
   *
    * @returns {number}
   */
  get duration() {
    return this.currentState.duration;
  }

  /**
   *
    * @returns {number}
   */
  get progress() {
    return Math.min(1, this.#elapsed / this.duration);
  }

  /**
   *
    * @returns {string}
   */
  get action() {
    return this.currentState.action;
  }

  /**
   *
    * @returns {string}
   */
  get animation() {
    return this.currentState.animation;
  }

  /**
   *
    * @returns {import("src/game/objects/ObjectTypes.js").TerraceActivityState}
   */
  get state() {
    return {
      name: this.phase,
      stagePhase: this.stagePhase,
      action: this.action,
      animation: this.animation,
      progress: this.progress,
      interrupted: this.interrupted,
    };
  }

  /**
   *
    * @returns {boolean}
   */
  get active() {
    return !this.in(this.#dormantPhase);
  }

  /**
   *
    * @returns {boolean}
   */
  get interrupted() {
    return this.#interruptions.length > 0;
  }

  set actionHandler(handler) {
    this.#actionHandler = handler;
  }

  /**
   *
   * @param {import("./states/terrace/AbstractTerraceParticipantState.js").AbstractTerraceParticipantState} state
   */
  enterAction(state) {
    this.#actionHandler?.enter?.(state, this);
  }

  /**
   *
   * @param {import("./states/terrace/AbstractTerraceParticipantState.js").AbstractTerraceParticipantState} state
   */
  updateAction(state) {
    this.#actionHandler?.update?.(state, this);
  }

  /**
   *
   * @param {import("./states/terrace/AbstractTerraceParticipantState.js").AbstractTerraceParticipantState} state
   */
  exitAction(state) {
    this.#actionHandler?.exit?.(state, this);
  }

  /**
   *
   * @param {number} deltaTime
   */
  update(deltaTime) {
    if (!this.active || !Number.isFinite(deltaTime) || deltaTime <= 0) {
      return;
    }
    this.#elapsed += deltaTime;
    while (this.#elapsed >= this.duration) {
      const state = this.currentState;
      super.update();
      if (this.currentState === state) {
        break;
      }
    }
  }

  /**
   *
   * @param {string} phase
   */
  transition(phase) {
    this.changeTo(phase);
    this.#elapsed = 0;
  }

  /**
   *
   * @param {import("./states/terrace/AbstractTerraceParticipantState.js").AbstractTerraceParticipantState} state
   */
  completeState(state) {
    if (this.#elapsed < state.duration) {
      return;
    }
    const remaining = this.#elapsed - state.duration;
    if (state.resumeOnComplete && this.resume()) {
      this.#elapsed += remaining;
      return;
    }
    this.transition(this.nextPhase(state.phase));
    this.#elapsed = remaining;
  }

  /**
   *
   * @param {import("./states/terrace/AbstractTerraceParticipantState.js").AbstractTerraceParticipantState} state
   */
  addInterruption(state) {
    this.add(state.phase, state);
    return this;
  }

  /**
   *
   * @param {string} phase
   */
  interrupt(phase) {
    if (!this.active || !this.get(phase)) {
      return false;
    }
    this.#interruptions.push({ phase: this.phase, elapsed: this.#elapsed });
    this.transition(phase);
    return true;
  }

  resume() {
    const interrupted = this.#interruptions.pop();
    if (!interrupted) {
      return false;
    }
    this.changeTo(interrupted.phase);
    this.#elapsed = interrupted.elapsed;
    return true;
  }

  reset() {
    this.#interruptions = [];
    this.transition(this.#dormantPhase);
  }
}
