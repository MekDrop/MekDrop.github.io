import { KING_ANIMATION as A } from "../../../../enum/KingAnimation.js";

/**
 * Timings belong to the independent actions baked in king.blend.
 */
export class KingTrainingClips {
  /**
   * @type {Map<string,{duration:number,contacts:number[],exercise:boolean}>}
   */
  static #clips = new Map([
    [A.SWORD_COMBINATION, {
      duration: 149 / 24,
      contacts: [1.55, 5.15],
      exercise: true,
    }],
    [A.ADVANCE_RETREAT, {
      duration: 150 / 24,
      contacts: [7.2, 8, 8.8, 10.2, 11, 11.8].map(/**
     *
     * @param {number} time
     */
        time => time - 149 / 24),
      exercise: true,
    }],
    [A.HALF_TURN_PRACTICE, {
      duration: 68 / 24,
      contacts: [13.05, 13.5, 14.4, 14.85].map(/**
     *
     * @param {number} time
     */
        time => time - 299 / 24),
      exercise: true,
    }],
    [A.JUMP_SPIN, {
      duration: 72 / 24,
      contacts: [17.25 - 367 / 24],
      exercise: true,
    }],
    [A.GUARD_PRACTICE, {
      duration: 60 / 24,
      contacts: [],
      exercise: true,
    }],
    [A.GROUND_SIT_DOWN, {
      duration: 1.5,
      contacts: [0.55, 0.9],
      exercise: false,
    }],
    [A.GROUND_REST, {
      duration: 2.5,
      contacts: [],
      exercise: false,
    }],
    [A.GROUND_STAND_UP, {
      duration: 1.5,
      contacts: [0.95, 1.3],
      exercise: false,
    }],
  ]);

  /**
   * @param {string} clip
   * @returns {number}
   */
  static duration(clip) {
    return this.#clips.get(clip)?.duration ?? Infinity;
  }

  /**
   * @param {string} clip
   * @returns {number[]}
   */
  static contacts(clip) {
    return this.#clips.get(clip)?.contacts ?? [];
  }

  /**
   * @param {string} clip
   * @returns {boolean}
   */
  static isExercise(clip) {
    return this.#clips.get(clip)?.exercise ?? false;
  }
}
