export class InvalidOverpassError extends Error {
  /**
   *
   * @param {{reason: string}} options
   * @param {string} options.reason
   */
  constructor({ reason }) {
    super(`Map validation failed: grade-separated crossing ${reason}.`);
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
