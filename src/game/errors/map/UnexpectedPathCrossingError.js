export class UnexpectedPathCrossingError extends Error {
  /**
   *
   * @param {{col: number, row: number}} options
   * @param {number} options.col
   * @param {number} options.row
   */
  constructor({ col, row }) {
    super(
      `Map validation failed: paths form an unplanned flat crossing at (${col}, ${row}).`,
    );
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
