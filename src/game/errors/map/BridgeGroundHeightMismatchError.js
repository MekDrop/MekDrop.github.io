export class BridgeGroundHeightMismatchError extends Error {
  /**
   *
   * @param {{col: number, row: number, expectedHeight: number, actualHeight: number}} options
   * @param {number} options.col
   * @param {number} options.row
   * @param {number} options.expectedHeight
   * @param {number} options.actualHeight
   */
  constructor({ col, row, expectedHeight, actualHeight }) {
    super(
      `Map validation failed: bridge tile at (${col}, ${row}) requires grass ground at height ${expectedHeight}, not ${actualHeight}.`,
    );
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
