export class PathRenderModeMismatchError extends Error {
  /**
   *
   * @param {{col: number, row: number, expected: string|number|boolean|null, actual: string|number|boolean|null}} options
   * @param {number} options.col
   * @param {number} options.row
   * @param {string|number|boolean|null} options.expected
   * @param {string|number|boolean|null} options.actual
   */
  constructor({ col, row, expected, actual }) {
    super(
      `Map validation failed: path tile at (${col}, ${row}) must render as ${expected}, not ${actual}.`,
    );
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
