export class GameModelAnimationMissingError extends Error {
  constructor({ url, animation }) {
    super(`Game model "${url}" is missing animation "${animation}".`);
    this.name = "GameModelAnimationMissingError";
  }
}
