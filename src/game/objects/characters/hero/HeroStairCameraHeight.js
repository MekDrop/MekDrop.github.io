/**
 * Presentation-only stair easing. Capsule contact and horizontal look stay immediate.
 * The result is still passed through the hero's eye-to-ceiling collision probe.
 */
export class HeroStairCameraHeight {
  /**
   * @type {number|null}
   */
  #height = null;
  /**
   * @type {number|null}
   */
  #previous = null;
  /**
   * @type {boolean}
   */
  #settling = false;

  reset() {
    this.#height = null;
    this.#previous = null;
    this.#settling = false;
  }

  /**
   * @param {number} height Capsule foot height.
   * @param {number} deltaTime Render delta in seconds.
   * @param {{onStairs:boolean,freeMotion:boolean}} options
   * @returns {number} Small eye-height offset, never a physics correction.
   */
  update(height, deltaTime, { onStairs, freeMotion }) {
    if (freeMotion || this.#height === null || Math.abs(height - this.#previous) > 0.65) {
      this.#height = height;
      this.#previous = height;
      this.#settling = false;

      return 0;
    }
    this.#previous = height;
    this.#settling ||= onStairs;
    if (!this.#settling) {
      this.#height = height;

      return 0;
    }
    const blend = 1 - Math.exp(-12 * Math.max(0, deltaTime));
    this.#height += (height - this.#height) * blend;
    // Never lag far enough behind the actor to enter another storey.
    this.#height = Math.max(height - 0.24, Math.min(height + 0.24, this.#height));
    if (!onStairs && Math.abs(height - this.#height) < 0.001) {
      this.#height = height;
      this.#settling = false;
    }
    return this.#height - height;
  }
}
