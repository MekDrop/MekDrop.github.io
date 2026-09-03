export class DisconnectedTerrainError extends Error {
  constructor() {
    super("Map validation failed: playable terrain is not one connected island.");
    this.name = this.constructor.name;
  }
}
