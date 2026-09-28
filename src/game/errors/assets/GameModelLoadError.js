export class GameModelLoadError extends Error {
  /**
   *
   * @param {{url: string, cause: string|Error}} options
   * @param {string} options.url
   * @param {string|Error} options.cause
   */
  constructor({ url, cause }) {
    super(`Unable to load game model from ${url}.`, { cause });
    /**
     *
     * @type {string}
     */
    this.name = "GameModelLoadError";
  }
}
