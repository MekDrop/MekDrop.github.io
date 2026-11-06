import { NpcStateMachine } from "../../../shared/NpcStateMachine.js";
import { KING_ANIMATION as ANIMATION } from "../../../../enum/KingAnimation.js";
import { KingTrainingClips } from "./KingTrainingClips.js";
import { KingSwordCombinationState } from "../../states/terrace/king/training/KingSwordCombinationState.js";
import { KingAdvanceRetreatState } from "../../states/terrace/king/training/KingAdvanceRetreatState.js";
import { KingHalfTurnState } from "../../states/terrace/king/training/KingHalfTurnState.js";
import { KingJumpSpinState } from "../../states/terrace/king/training/KingJumpSpinState.js";
import { KingGuardPracticeState } from "../../states/terrace/king/training/KingGuardPracticeState.js";
import { KingGroundSitDownState } from "../../states/terrace/king/training/KingGroundSitDownState.js";
import { KingGroundRestState } from "../../states/terrace/king/training/KingGroundRestState.js";
import { KingGroundStandUpState } from "../../states/terrace/king/training/KingGroundStandUpState.js";

/**
 * Separate Yuka action states choose random, guard-ended exercises and own fatigue.
 */
export class KingTrainingRoutine extends NpcStateMachine {
  /**
   * @type {Array<new () => import("../../states/terrace/king/training/KingTrainingActionState.js").KingTrainingActionState>}
   */
  static #exercises = [KingSwordCombinationState, KingAdvanceRetreatState,
    KingHalfTurnState, KingJumpSpinState, KingGuardPracticeState];
  /**
   * @type {number}
   */
  #stamina = 1;
  /**
   * @type {number}
   */
  #trainingSeconds;
  /**
   * @type {number}
   */
  #recoverySeconds;
  /**
   * @type {() => number}
   */
  #random;
  /**
   * @type {string|null}
   */
  #lastExercise = null;
  /**
   * @type {string|null}
   */
  #activeClip = null;
  /**
   * @type {number}
   */
  #playbackTime = 0;

  /**
   * @param {{random?:()=>number,trainingSeconds?:number,recoverySeconds?:number}} options
   */
  constructor({ random = Math.random, trainingSeconds = 65, recoverySeconds = 6 } = {}) {
    super();

    this.owner = this;
    this.#random = random;
    this.#trainingSeconds = trainingSeconds;
    this.#recoverySeconds = recoverySeconds;
    for (const Type of [...KingTrainingRoutine.#exercises,
      KingGroundSitDownState, KingGroundRestState, KingGroundStandUpState]) {
      this.add(Type.name, new Type());
    }
    this.#chooseExercise();
  }

  get stamina() {
    return this.#stamina;
  }

  /**
   * @param {number} value
   */
  set stamina(value) {
    if (Number.isFinite(value)) {
      this.#stamina = Math.max(0, Math.min(1, value));
    }
  }

  /**
   * @returns {string}
   */
  get clip() {
    return this.currentState.clip;
  }

  /**
   * @returns {string}
   */
  get stateName() {
    return this.currentState.constructor.name;
  }

  /**
   * @returns {boolean}
   */
  get resting() {
    return !KingTrainingClips.isExercise(this.clip);
  }

  /**
   * @returns {number}
   */
  get speed() {
    return this.resting ? 1 : 0.45 + 0.55 * this.#stamina;
  }

  /**
   * @returns {number}
   */
  get progress() {
    return this.clip === ANIMATION.GROUND_REST ? this.#stamina
      : this.#activeClip === this.clip ? Math.min(1, this.#playbackTime / KingTrainingClips.duration(this.clip)) : 0;
  }

  /**
   * @param {number} dt
   * @param {string|null} activeClip
   * @param {number} elapsed
   * @returns {KingTrainingRoutine}
   */
  update(dt, activeClip, elapsed) {
    if (!Number.isFinite(dt) || dt < 0 || !Number.isFinite(elapsed) || this.reacting) {
      return this;
    }
    this.#activeClip = activeClip;
    this.#playbackTime = elapsed;
    const delta = Math.min(0.25, dt);
    if (activeClip === this.clip) {
      if (KingTrainingClips.isExercise(this.clip)) {
        this.stamina = this.#stamina - delta / this.#trainingSeconds;
      } else if (this.clip === ANIMATION.GROUND_REST) {
        this.stamina = this.#stamina + delta / this.#recoverySeconds;
      }
    }
    super.update();

    return this;
  }

  /**
   * @param {import("../../states/terrace/king/training/KingTrainingActionState.js").KingTrainingActionState} state
   */
  completeAction(state) {
    if (this.#activeClip !== state.clip) {
      return;
    }
    if (state instanceof KingGroundRestState) {
      if (this.#stamina >= 1) {
        this.changeTo(KingGroundStandUpState.name);
      }
      return;
    }
    if (this.#playbackTime < KingTrainingClips.duration(state.clip) - 0.00001) {
      return;
    }
    if (state instanceof KingGroundSitDownState) {
      this.changeTo(KingGroundRestState.name);
    } else if (state instanceof KingGroundStandUpState) {
      this.#chooseExercise();
    } else if (this.#stamina === 0) {
      this.changeTo(KingGroundSitDownState.name);
    } else {
      this.#chooseExercise();
    }
  }

  /**
   * Get up before a cancelled activity resumes navigation.
   */
  finish() {
    if (this.resting && !(this.currentState instanceof KingGroundStandUpState)) {
      this.changeTo(KingGroundStandUpState.name);
    }
  }

  #chooseExercise() {
    const candidates = KingTrainingRoutine.#exercises.filter(/**
     *
     * @param {typeof KingSwordCombinationState} Type
     */
      Type => Type.name !== this.#lastExercise);
    const index = Math.min(candidates.length - 1,
      Math.floor(Math.max(0, Math.min(1, this.#random())) * candidates.length));
    const Type = candidates[index];
    this.#lastExercise = Type.name;
    this.changeTo(Type.name);
  }
}
