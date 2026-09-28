export class StoredMapNotFoundError extends Error {
  /**
   *
   * @param {{mapName: string}} options
   * @param {string} options.mapName
   */
  constructor({ mapName }) {
    super(`Stored map "${mapName}" was not found.`);
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
