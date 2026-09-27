import { StateMachine } from "yuka";

/**
 * Game-time Yuka machine shared by individual terrace participants.
 * @abstract
 */
export class TerraceParticipantStateMachine extends StateMachine {
  #dormantPhase;
  #elapsed = 0;
  #interruptions = [];
  #actionHandler = null;

  constructor({ dormantPhase, states }) {
    super();
    this.owner = this;
    this.#dormantPhase = dormantPhase;
    for (const state of states) {
      this.add(state.phase, state);
    }
    this.changeTo(dormantPhase);
  }

  get phase() {
    return this.currentState.phase;
  }

  get stagePhase() {
    return this.currentState.stagePhase;
  }

  get elapsed() {
    return this.#elapsed;
  }

  get duration() {
    return this.currentState.duration;
  }

  get progress() {
    return Math.min(1, this.#elapsed / this.duration);
  }

  get action() {
    return this.currentState.action;
  }

  get animation() {
    return this.currentState.animation;
  }

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

  get active() {
    return !this.in(this.#dormantPhase);
  }

  get interrupted() {
    return this.#interruptions.length > 0;
  }

  set actionHandler(handler) {
    this.#actionHandler = handler;
  }

  enterAction(state) {
    this.#actionHandler?.enter?.(state, this);
  }

  updateAction(state) {
    this.#actionHandler?.update?.(state, this);
  }

  exitAction(state) {
    this.#actionHandler?.exit?.(state, this);
  }

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

  transition(phase) {
    this.changeTo(phase);
    this.#elapsed = 0;
  }

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

  addInterruption(state) {
    this.add(state.phase, state);
    return this;
  }

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
