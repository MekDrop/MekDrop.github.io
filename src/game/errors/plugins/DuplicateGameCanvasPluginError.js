export class DuplicateGameCanvasPluginError extends Error {
  /**
   *
   * @param {string} pluginId
   */
  constructor(pluginId) {
    super(`Duplicate game canvas plugin id: ${pluginId}`);
    /**
     *
     * @type {string}
     */
    this.name = DuplicateGameCanvasPluginError.name;
  }
}
