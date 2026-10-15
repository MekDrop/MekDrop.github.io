const NEAR_PERIOD = 5.3;
const FAR_PERIOD = 7.7;
const NEAR_AMPLITUDE = 0.065;
const FAR_AMPLITUDE = 0.045;

/**
 * Gentle visual bobbing with a distinct period for every island section.
 */
export class IslandConnectorMotion {
  /**
   * @type {number}
   */
  #elapsed = 0;

  /**
   * @param {number} count
   * @param {number} deltaTime
   */
  update(deltaTime, count = 2) {
    this.#elapsed += deltaTime;
    const groups = Array.from({ length: count }, /**
     *
     * @param {number} value
     * @param {number} index
     */
      (value, index) => {
        const period = index === 0 ? NEAR_PERIOD : FAR_PERIOD + (index - 1) * 2.4;
        const amplitude = index === 0 ? NEAR_AMPLITUDE : FAR_AMPLITUDE;

        return Math.sin(this.#elapsed * Math.PI * 2 / period) * amplitude;
      });

    return {
      groups,
      near: Math.sin(this.#elapsed * Math.PI * 2 / NEAR_PERIOD) * NEAR_AMPLITUDE,
      far: Math.sin(this.#elapsed * Math.PI * 2 / FAR_PERIOD) * FAR_AMPLITUDE,
    };
  }
}
