import { NpcStateMachine } from "../../shared/NpcStateMachine.js";
import { RoyalWalkOutState } from "./RoyalWalkOutState.js";

/**
 * Shared state-machine foundation for a royal's final-death reaction.
 * @abstract
 */
export class RoyalGameOverBehaviorBase {
  /**
   *
   * @type {NpcStateMachine}
   */
  #stateMachine;
  /**
   *
   * @type {{isResumingReaction: () => boolean, elapsed: number, deltaTime: number, walkDuration: number, walkStartDelay: number, beginWalk: () => void, move: (progress: number) => boolean|null, playAnimation: (animation: string, blendDuration: number) => void, completeWalk: () => void}}
   */
  #context;
  /**
   *
   * @type {{lateral: number, forward: number, elevation: number}}
   */
  #destination;

  /**
   *
   * @param {{CryStateType: new () => import("yuka").State, destination: {lateral: number, forward: number, elevation: number}, walkDuration: number, walkStartDelay: number, beginWalk: () => void, move: (progress: number) => boolean|null, playAnimation: (animation: string, blendDuration: number) => void}} options
   * @param {new () => import("yuka").State} options.CryStateType
   * @param {{lateral: number, forward: number, elevation: number}} options.destination
   * @param {number} options.walkDuration
   * @param {number} options.walkStartDelay
   * @param {() => void} options.beginWalk
   * @param {(progress: number) => boolean|null} options.move
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
      isResumingReaction: this.#isResumingReaction.bind(this),
      elapsed: 0,
      deltaTime: 0,
      walkDuration,
      walkStartDelay,
      beginWalk,
      move,
      playAnimation,
      completeWalk: () => this.#stateMachine.changeTo(CryStateType.name),
    };
    this.#stateMachine = new NpcStateMachine(this.#context);
    this.#stateMachine.add(RoyalWalkOutState.name, new RoyalWalkOutState());
    this.#stateMachine.add(CryStateType.name, new CryStateType());
  }

  /**
   * @returns {NpcStateMachine}
   */
  get stateMachine() {
    return this.#stateMachine;
  }

  /**
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
    return this.#stateMachine.taskState !== null;
  }

  /**
   *
   * @returns {number}
   */
  get phase() {
    return this.#stateMachine.taskState?.phase ?? null;
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

  #isResumingReaction() {
    return this.#stateMachine.resumingReaction;
  }
}
