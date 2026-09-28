export class IsolatedTerrainHoleError extends Error {
  /**
   *
   * @param {{col: number, row: number}} options
   * @param {number} options.col
   * @param {number} options.row
   */
  constructor({ col, row }) {
    super(
      `Map validation failed: isolated one-tile terrain hole at (${col}, ${row}).`,
    );
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
