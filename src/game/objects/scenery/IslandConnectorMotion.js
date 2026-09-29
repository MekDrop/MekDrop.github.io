const NEAR_PERIOD = 5.3;
const FAR_PERIOD = 7.7;
const NEAR_AMPLITUDE = 0.065;
const FAR_AMPLITUDE = 0.045;

/**
 * Gentle visual bobbing for two islands and a connector attached to the near island.
 */
export class IslandConnectorMotion {
  /**
   * @type {number}
   */
  #elapsed = 0;

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    this.#elapsed += deltaTime;
    return {
      near: Math.sin(this.#elapsed * Math.PI * 2 / NEAR_PERIOD) * NEAR_AMPLITUDE,
      far: Math.sin(this.#elapsed * Math.PI * 2 / FAR_PERIOD) * FAR_AMPLITUDE,
    };
  }
}
