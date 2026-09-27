import { StateMachine } from "yuka";
import { HERO_ANIMATION } from "../../../../enum/HeroAnimation.js";
import { HERO_IDLE_ACTION } from "../../../../enum/HeroIdleAction.js";
import { HeroIdleState } from "../../states/action/HeroIdleState.js";

const IDLE_DELAY = 5;
const BREAK_MIN = 2.5;
const BREAK_VARIANCE = 2;
const BORED_STATES = Object.freeze([
  HERO_IDLE_ACTION.CURSOR_LOOK,
  HERO_IDLE_ACTION.LOOK,
  HERO_IDLE_ACTION.STRETCH,
  HERO_IDLE_ACTION.TAP,
]);
const STATE_ANIMATIONS = new Map([
  [HERO_IDLE_ACTION.WAIT, HERO_ANIMATION.IDLE],
  [HERO_IDLE_ACTION.CURSOR_LOOK, HERO_ANIMATION.BORED_CURSOR_LOOK],
  [HERO_IDLE_ACTION.LOOK, HERO_ANIMATION.BORED_LOOK],
  [HERO_IDLE_ACTION.STRETCH, HERO_ANIMATION.BORED_STRETCH],
  [HERO_IDLE_ACTION.TAP, HERO_ANIMATION.BORED_TAP],
]);
const STATE_DURATIONS = new Map([
  [HERO_IDLE_ACTION.CURSOR_LOOK, 3],
  [HERO_IDLE_ACTION.LOOK, 3],
  [HERO_IDLE_ACTION.STRETCH, 3.5],
  [HERO_IDLE_ACTION.TAP, 3],
]);

export class HeroIdleBehavior {
  #stateMachine;
  #context;
  #boredIndex = 0;
  #hasLookTarget = false;
  #random;

  constructor(random = Math.random) {
    this.#random = random;
    this.#context = {
      remaining: IDLE_DELAY,
      deltaTime: 0,
      idleDuration: IDLE_DELAY,
      complete: () => this.#complete(),
    };
    this.#stateMachine = new StateMachine(this.#context);
    for (const [state, animation] of STATE_ANIMATIONS) {
      this.#stateMachine.add(
        state,
        new HeroIdleState(
          state,
          animation,
          STATE_DURATIONS.get(state),
        ),
      );
    }
    this.#stateMachine.changeTo(HERO_IDLE_ACTION.WAIT);
  }

  get animation() {
    return this.#stateMachine.currentState.animation;
  }

  advance(deltaTime, { hasLookTarget = false } = {}) {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) {
      return this.animation;
    }
    this.#hasLookTarget = hasLookTarget;
    this.#context.deltaTime = deltaTime;
    this.#stateMachine.update();
    return this.animation;
  }

  reset() {
    this.#context.idleDuration = IDLE_DELAY;
    this.#context.remaining = IDLE_DELAY;
    if (!this.#stateMachine.in(HERO_IDLE_ACTION.WAIT)) {
      this.#stateMachine.changeTo(HERO_IDLE_ACTION.WAIT);
    }
  }

  #complete() {
    if (!this.#stateMachine.in(HERO_IDLE_ACTION.WAIT)) {
      this.#context.idleDuration =
        BREAK_MIN + this.#random() * BREAK_VARIANCE;
      this.#stateMachine.changeTo(HERO_IDLE_ACTION.WAIT);
      return;
    }
    this.#stateMachine.changeTo(this.#nextBoredState);
  }

  get #nextBoredState() {
    let state;
    do {
      state = BORED_STATES[this.#boredIndex];
      this.#boredIndex = (this.#boredIndex + 1) % BORED_STATES.length;
    } while (
      state === HERO_IDLE_ACTION.CURSOR_LOOK &&
      !this.#hasLookTarget
    );
    return state;
  }
}
