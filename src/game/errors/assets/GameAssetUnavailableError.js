export class GameAssetUnavailableError extends Error {
  /**
   * @param {{type:string, url:string}} context
   */
  constructor({ type, url }) {
    super(`Game ${type} from ${url} is not available in its asset library.`);

    this.name = "GameAssetUnavailableError";
  }
}
