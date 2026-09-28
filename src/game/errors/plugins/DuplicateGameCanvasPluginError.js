export class DuplicateGameCanvasPluginError extends Error {
  constructor(pluginId) {
    super(`Duplicate game canvas plugin id: ${pluginId}`);
    this.name = DuplicateGameCanvasPluginError.name;
  }
}
