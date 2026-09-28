export class InvalidVegetationPlacementError extends Error {
  /**
   *
   * @param {{col: number, row: number, reason: string}} options
   * @param {number} options.col
   * @param {number} options.row
   * @param {string} options.reason
   */
  constructor({ col, row, reason }) {
    super(
      `Map validation failed: vegetation at (${col}, ${row}) ${reason}.`,
    );
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
