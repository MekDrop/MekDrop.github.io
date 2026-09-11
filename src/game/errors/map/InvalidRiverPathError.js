export class InvalidRiverPathError extends Error {
  constructor({ riverId, reason }) {
    super(`Map validation failed: ${riverId} ${reason}.`);
    this.name = this.constructor.name;
  }
}
