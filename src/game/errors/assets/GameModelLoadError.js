export class GameModelLoadError extends Error {
  constructor({ url, cause }) {
    super(`Unable to load game model from ${url}.`, { cause });
    this.name = "GameModelLoadError";
  }
}
