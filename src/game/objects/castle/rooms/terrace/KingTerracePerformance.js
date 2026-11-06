import { KING_ANIMATION } from "../../../../enum/KingAnimation.js";
import { KingTrainingRoutine } from "./KingTrainingRoutine.js";
import { KingTrainingClips } from "./KingTrainingClips.js";

/**
 * Selects independent authored exercises and recovery states while tracking fatigue.
 */
export class KingTerracePerformance {
  /**
   * @type {KingTrainingRoutine}
   */
  #routine;
  /**
   * @type {number|null}
   */
  #previousTime = null;

  /**
   * @param {ConstructorParameters<typeof KingTrainingRoutine>[0]} options
   */
  constructor(options = {}) {
    this.#routine = new KingTrainingRoutine(options);
  }

  get routine() {
    return this.#routine;
  }

  /**
   * @returns {number}
   */
  get stamina() {
    return this.#routine.stamina;
  }

  /**
   * @param {number} value
   */
  set stamina(value) {
    this.#routine.stamina = value;
  }

  /**
   * @returns {boolean}
   */
  get resting() {
    return this.#routine.resting;
  }

  /**
   * @param {string} action
   * @param {number} time
   * @param {number} blend
   * @param {{clip:string|null,time:number}} playback
   * @returns {{clip:string,repeated:boolean,failed:boolean,sequenceStep:string,offset:{x:number,y:number,z:number},yaw:number,speed:number}}
   */
  sample(action, time, blend = 1, playback = {
    clip: null,
    time: 0,
  }) {
    const dt = this.#previousTime === null ? 0 : Math.max(0, time - this.#previousTime);
    this.#previousTime = action === "sword" ? time : null;
    if (action === "sword" && blend === 1) {
      this.#routine.update(dt, playback.clip, playback.time);
    } else if (action === "sword" && time > 0) {
      this.#routine.finish();
      this.#routine.update(0, playback.clip, playback.time);
    }
    const clip = action === "walk" ? KING_ANIMATION.TERRACE_WALK
      : action !== "sword" ? KING_ANIMATION.TERRACE_IDLE
        : blend < 1 ? time > 0
          ? this.#routine.resting ? KING_ANIMATION.GROUND_STAND_UP : KING_ANIMATION.SWORD_FINISH
          : KING_ANIMATION.SWORD_READY
          : this.#routine.clip;

    return {
      clip,
      repeated: false,
      failed: false,
      sequenceStep: action === "sword" && blend === 1 ? this.#routine.stateName : clip,
      offset: {
        x: 0,
        y: 0,
        z: 0,
      },
      yaw: 0,
      speed: KingTrainingClips.isExercise(clip) ? this.#routine.speed : 1,
    };
  }
}
