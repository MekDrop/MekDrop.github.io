export class InvalidStonePlacementError extends Error {
  /**
   *
   * @param {{col: number, row: number}} options
   * @param {number} options.col
   * @param {number} options.row
   */
  constructor({ col, row }) {
    super(
      `Map validation failed: stone cluster at (${col}, ${row}) is not on clear flat grass or has invalid parts.`,
    );
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
