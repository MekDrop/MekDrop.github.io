export class NoPlayableTerrainError extends Error {
  constructor() {
    super("Map validation failed: island has no playable terrain.");
    this.name = this.constructor.name;
  }
}
