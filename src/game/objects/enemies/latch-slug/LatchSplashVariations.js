import { latchSplashProfiles } from "./LatchSplashProfiles.js";

/**
 * A shuffled set prevents repeats; continuous proportions keep each impact distinct.
 */
export class LatchSplashVariations {
  /**
   * @type {number[]}
   */
  #remaining = [];
  /**
   * @type {number}
   */
  #last = -1;

  /**
   * @param {number} contactHeight Metres above the floor.
   * @param {() => number} random
   * @returns {{profile: typeof latchSplashProfiles[number], width:number, height:number, thickness:number, speed:number, stopTime:number}}
   */
  next(contactHeight, random = Math.random) {
    if (!this.#remaining.length) {
      this.#remaining = latchSplashProfiles.map(/**
       *
       * @param {(typeof latchSplashProfiles)[number]} profile
       */
        (profile) => profile.id);
      for (let index = this.#remaining.length - 1; index > 0; index--) {
        const other = Math.floor(random() * (index + 1));
        [this.#remaining[index], this.#remaining[other]] = [this.#remaining[other], this.#remaining[index]];
      }
      const end = this.#remaining.length - 1;
      if (this.#remaining[end] === this.#last) {
        [this.#remaining[0], this.#remaining[end]] = [this.#remaining[end], this.#remaining[0]];
      }
    }
    const profile = latchSplashProfiles[this.#remaining.pop()];
    this.#last = profile.id;
    const width = 0.83 + random() * 0.34;
    const height = 0.84 + random() * 0.24;
    const thickness = 0.7 + random() * 0.65;
    const speed = 0.78 + random() * 0.44;
    // Use the last sampled safe pose, with clearance for a final animation step.
    // Bounds belong to the selected shape, rather than the former single blob.
    let stopTime = 0.3;
    for (const [time, depth] of profile.depthBySecond) {
      if (depth * height <= contactHeight - 0.08) {
        stopTime = time;
      }
    }

    return {
      profile,
      width,
      height,
      thickness,
      speed,
      stopTime,
    };
  }
}
