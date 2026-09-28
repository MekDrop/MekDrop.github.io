export class InsufficientVegetationVarietyError extends Error {
  /**
   *
   * @param {{expected: string|number|boolean|null, actual: string|number|boolean|null}} options
   * @param {string|number|boolean|null} options.expected
   * @param {string|number|boolean|null} options.actual
   */
  constructor({ expected, actual }) {
    super(
      `Map validation failed: expected at least ${expected} vegetation variations but generated ${actual}.`,
    );
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
