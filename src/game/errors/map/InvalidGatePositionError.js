export class InvalidGatePositionError extends Error {
  constructor() {
    super(
      "Map validation failed: gate is not placed on the first boundary path tiles.",
    );
    this.name = this.constructor.name;
  }
}
