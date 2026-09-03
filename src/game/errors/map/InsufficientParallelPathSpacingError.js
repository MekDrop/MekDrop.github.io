export class InsufficientParallelPathSpacingError extends Error {
  constructor() {
    super(
      "Map validation failed: two parallel paths are separated by fewer than two full grass tiles outside a merge zone.",
    );
    this.name = this.constructor.name;
  }
}
