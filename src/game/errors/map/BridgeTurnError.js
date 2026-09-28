export class BridgeTurnError extends Error {
  /**
   *
   * @param {{col: number, row: number}} options
   * @param {number} options.col
   * @param {number} options.row
   */
  constructor({ col, row }) {
    super(
      `Map validation failed: bridge at (${col}, ${row}) connects to a perpendicular bridge segment.`,
    );
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
