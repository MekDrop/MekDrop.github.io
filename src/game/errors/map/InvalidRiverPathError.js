export class InvalidRiverPathError extends Error {
  /**
   *
   * @param {{riverId: string, reason: string}} options
   * @param {string} options.riverId
   * @param {string} options.reason
   */
  constructor({ riverId, reason }) {
    super(`Map validation failed: ${riverId} ${reason}.`);
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
