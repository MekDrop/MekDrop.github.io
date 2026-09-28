export class GameModelAnimationMissingError extends Error {
  /**
   *
   * @param {{url: string, animation: string}} options
   * @param {string} options.url
   * @param {string} options.animation
   */
  constructor({ url, animation }) {
    super(`Game model "${url}" is missing animation "${animation}".`);
    /**
     *
     * @type {string}
     */
    this.name = "GameModelAnimationMissingError";
  }
}
