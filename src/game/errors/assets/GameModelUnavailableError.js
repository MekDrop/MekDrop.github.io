export class GameModelUnavailableError extends Error {
  constructor({ url }) {
    super(`Game model from ${url} is not available in the loaded model library.`);
    this.name = "GameModelUnavailableError";
  }
}
