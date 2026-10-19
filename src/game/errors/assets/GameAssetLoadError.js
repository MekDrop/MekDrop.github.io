export class GameAssetLoadError extends Error {
  /**
   * @param {{type:string, url:string, cause:Error|string}} context
   */
  constructor({ type, url, cause }) {
    super(`Unable to load game ${type} from ${url}.`, { cause });

    this.name = "GameAssetLoadError";
  }
}
