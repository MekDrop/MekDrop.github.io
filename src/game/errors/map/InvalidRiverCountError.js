export class InvalidRiverCountError extends Error {
  /**
   *
   * @param {{count: number, maximum: number}} options
   * @param {number} options.count
   * @param {number} options.maximum
   */
  constructor({ count, maximum }) {
    super(
      `Map validation failed: river count ${count} is outside the allowed range of 0 to ${maximum}.`,
    );
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
