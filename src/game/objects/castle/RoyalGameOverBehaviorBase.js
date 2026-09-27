import { StateMachine } from "yuka";
import { RoyalWalkOutState } from "./RoyalWalkOutState.js";

/**
 * Shared state-machine foundation for a royal's final-death reaction.
 * @abstract
 */
export class RoyalGameOverBehaviorBase {
  #stateMachine;
  #context;
  #destination;

  constructor({
    CryStateType,
    destination,
    walkDuration,
    walkStartDelay,
    beginWalk,
    move,
    playAnimation,
  }) {
    this.#destination = Object.freeze({ ...destination });
    this.#context = {
      elapsed: 0,
      deltaTime: 0,
      walkDuration,
      walkStartDelay,
      beginWalk,
      move,
      playAnimation,
      completeWalk: () => this.#stateMachine.changeTo(CryStateType.name),
    };
    this.#stateMachine = new StateMachine(this.#context);
    this.#stateMachine.add(RoyalWalkOutState.name, new RoyalWalkOutState());
    this.#stateMachine.add(CryStateType.name, new CryStateType());
  }

  get destination() {
    return { ...this.#destination };
  }

  get active() {
    return this.#stateMachine.currentState !== null;
  }

  get phase() {
    return this.#stateMachine.currentState?.phase ?? null;
  }

  start() {
    if (this.active) {
      return false;
    }
    this.#stateMachine.changeTo(RoyalWalkOutState.name);
    return true;
  }

  update(deltaTime) {
    if (!this.active || !Number.isFinite(deltaTime) || deltaTime <= 0) {
      return;
    }
    this.#context.deltaTime = deltaTime;
    this.#stateMachine.update();
  }
}
