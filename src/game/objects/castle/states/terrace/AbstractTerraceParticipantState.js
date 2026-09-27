import { State } from "yuka";

/**
 * Base state for one terrace participant and its linked presentation.
 * @abstract
 */
export class AbstractTerraceParticipantState extends State {
  #phase;
  #stagePhase;
  #duration;
  #action;
  #animation;
  #resumeOnComplete;

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

  enter(owner) {
    owner.enterAction(this);
  }

  execute(owner) {
    owner.updateAction(this);
    owner.completeState(this);
  }

  exit(owner) {
    owner.exitAction(this);
  }
}
