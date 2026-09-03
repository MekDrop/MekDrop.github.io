export class InsufficientCastleClearanceError extends Error {
  constructor() {
    super("Map validation failed: the castle is too close to an island edge.");
    this.name = this.constructor.name;
  }
}
