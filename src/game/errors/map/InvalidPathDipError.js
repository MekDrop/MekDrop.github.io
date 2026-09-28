export class InvalidPathDipError extends Error {
  /**
   *
   * @param {{id: string, reason: string}} options
   * @param {string} options.id
   * @param {string} options.reason
   */
  constructor({ id, reason }) {
    super(`Map validation failed: terrain path dip ${id} ${reason}.`);
    /**
     *
     * @type {string}
     */
    this.name = "InvalidPathDipError";
  }
}
