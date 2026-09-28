export class MapGenerationStageRunNotImplementedError extends Error {
  /**
   *
   * @param {string} stageName
   */
  constructor(stageName) {
    super(`Map generation stage ${stageName} must implement run(context).`);
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
