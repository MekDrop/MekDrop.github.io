export class GameModelUnavailableError extends Error {
  /**
   *
   * @param {{url: string}} options
   * @param {string} options.url
   */
  constructor({ url }) {
    super(`Game model from ${url} is not available in the loaded model library.`);
    /**
     *
     * @type {string}
     */
    this.name = "GameModelUnavailableError";
  }
}
