import { StateMachine } from "yuka";
import { RoyalWalkOutState } from "./RoyalWalkOutState.js";

/**
 * Shared state-machine foundation for a royal's final-death reaction.
 * @abstract
 */
export class RoyalGameOverBehaviorBase {
  /**
   *
    * @type {StateMachine}
   */
  #stateMachine;
  /**
   *
    * @type {{elapsed: number, deltaTime: number, walkDuration: number, walkStartDelay: number, beginWalk: () => void, move: (progress: number) => boolean, playAnimation: (animation: string, blendDuration: number) => void, completeWalk: () => void}}
   */
  #context;
  /**
   *
    * @type {{lateral: number, forward: number, elevation: number}}
   */
  #destination;

  /**
   *
   * @param {{CryStateType: new () => import("yuka").State, destination: {lateral: number, forward: number, elevation: number}, walkDuration: number, walkStartDelay: number, beginWalk: () => void, move: (progress: number) => boolean, playAnimation: (animation: string, blendDuration: number) => void}} options
   * @param {new () => import("yuka").State} options.CryStateType
   * @param {{lateral: number, forward: number, elevation: number}} options.destination
   * @param {number} options.walkDuration
   * @param {number} options.walkStartDelay
   * @param {() => void} options.beginWalk
   * @param {(progress: number) => boolean} options.move
   * @param {(animation: string, blendDuration: number) => void} options.playAnimation
   */
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

  /**
   *
    * @returns {import("src/game/objects/ObjectTypes.js").Point3}
   */
  get destination() {
    return { ...this.#destination };
  }

  /**
   *
    * @returns {boolean}
   */
  get active() {
    return this.#stateMachine.currentState !== null;
  }

  /**
   *
    * @returns {number}
   */
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

  /**
   *
   * @param {number} deltaTime
   */
  update(deltaTime) {
    if (!this.active || !Number.isFinite(deltaTime) || deltaTime <= 0) {
      return;
    }
    this.#context.deltaTime = deltaTime;
    this.#stateMachine.update();
  }
}
