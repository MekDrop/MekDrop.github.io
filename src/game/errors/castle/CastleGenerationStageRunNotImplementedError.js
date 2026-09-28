export class CastleGenerationStageRunNotImplementedError extends Error {
  /**
   *
   * @param {string} stageName
   */
  constructor(stageName) {
    super(`Castle generation stage ${stageName} must implement run(context).`);
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
