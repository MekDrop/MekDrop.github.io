export class InvalidLavaRiverCountError extends Error {
  /**
   *
   * @param {{lavaCount: number, riverCount: number, maximum: number}} options
   * @param {number} options.lavaCount
   * @param {number} options.riverCount
   * @param {number} options.maximum
   */
  constructor({ lavaCount, riverCount, maximum }) {
    super(
      `Map validation failed: ${lavaCount} lava rivers cannot appear among ${riverCount} total rivers; lava is limited to ${maximum} rivers and only islands with at most ${maximum} total rivers are eligible.`,
    );
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
