export class UnexpectedPathConnectionError extends Error {
  /**
   *
   * @param {{firstPathIndex: number, secondPathIndex: number, col: number, row: number}} options
   * @param {number} options.firstPathIndex
   * @param {number} options.secondPathIndex
   * @param {number} options.col
   * @param {number} options.row
   */
  constructor({ firstPathIndex, secondPathIndex, col, row }) {
    super(
      `Map validation failed: paths ${firstPathIndex} and ${secondPathIndex} connect outside their merge at (${col}, ${row}).`,
    );
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
