import { State } from "yuka";

/**
 * Base state for one terrace participant and its linked presentation.
 * @abstract
 */
export class AbstractTerraceParticipantState extends State {
  /**
   *
    * @type {string}
   */
  #phase;
  /**
   *
    * @type {string}
   */
  #stagePhase;
  /**
   *
    * @type {number}
   */
  #duration;
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
    * @type {boolean}
   */
  #resumeOnComplete;

  /**
   *
   * @param {{phase: number, stagePhase: string, duration: number, action: string, animation: string, resumeOnComplete: number}} options
   * @param {number} options.phase
   * @param {string} options.stagePhase
   * @param {number} options.duration
   * @param {string} options.action
   * @param {string} options.animation
   * @param {number} options.resumeOnComplete
   */
  constructor({
    phase,
    stagePhase,
    duration,
    action,
    animation,
    resumeOnComplete = false,
  }) {
    super();
    this.#phase = phase;
    this.#stagePhase = stagePhase;
    this.#duration = duration;
    this.#action = action;
    this.#animation = animation;
    this.#resumeOnComplete = resumeOnComplete;
  }

  get phase() {
    return this.#phase;
  }

  get stagePhase() {
    return this.#stagePhase;
  }

  get duration() {
    return this.#duration;
  }

  get action() {
    return this.#action;
  }

  get animation() {
    return this.#animation;
  }

  get resumeOnComplete() {
    return this.#resumeOnComplete;
  }

  /**
   *
   * @param {import("../../TerraceParticipantStateMachine.js").TerraceParticipantStateMachine} owner
   */
  enter(owner) {
    owner.enterAction(this);
  }

  /**
   *
   * @param {import("../../TerraceParticipantStateMachine.js").TerraceParticipantStateMachine} owner
   */
  execute(owner) {
    owner.updateAction(this);
    owner.completeState(this);
  }

  /**
   *
   * @param {import("../../TerraceParticipantStateMachine.js").TerraceParticipantStateMachine} owner
   */
  exit(owner) {
    owner.exitAction(this);
  }
}
