export class InvalidOverpassError extends Error {
  constructor({ reason }) {
    super(`Map validation failed: grade-separated crossing ${reason}.`);
    this.name = this.constructor.name;
  }
}
