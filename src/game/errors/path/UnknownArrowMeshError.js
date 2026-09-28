export class UnknownArrowMeshError extends Error {
  /**
   *
   * @param {KeyboardEvent} meshKey
   */
  constructor(meshKey) {
    super(`Unknown arrow mesh: ${meshKey}`);
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
    /**
     *
     * @type {string}
     */
    this.meshKey = meshKey;
  }
}
