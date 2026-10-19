export class GameAssetLibraryDestroyedError extends Error {
  /**
   * @param {{type:string, url:string}} context
   */
  constructor({ type, url }) {
    super(`Cannot load game ${type} ${url} after its asset library was destroyed.`);

    this.name = "GameAssetLibraryDestroyedError";
  }
}
