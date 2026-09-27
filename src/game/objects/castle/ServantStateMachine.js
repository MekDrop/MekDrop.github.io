import { State, StateMachine } from "yuka";

/**
 * Yuka state machine with game-time updates and resumable interruptions.
 */
export class ServantStateMachine extends StateMachine {
  #idlePhase;
  #initialPhase;
  #holdState;
  #elapsed = 0;
  #context;
  #interruptions = [];

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

  get phase() {
    return this.currentState.phase ?? this.#idlePhase;
  }

  get active() {
    return !this.in(this.#idlePhase);
  }

  get elapsed() {
    return this.#elapsed;
  }

  get action() {
    return this.currentState.action ?? null;
  }

  get animation() {
    return this.currentState.animation ?? null;
  }

  get alignmentAnimation() {
    return this.currentState.alignmentAnimation ?? this.animation;
  }

  get animation() {
    return this.currentState.animation ?? null;
  }

  get alignmentAnimation() {
    return this.currentState.alignmentAnimation ?? this.animation;
  }

  get interrupted() {
    return this.#interruptions.length > 0;
  }

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

  consume(duration) {
    this.#elapsed -= duration;
  }

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
