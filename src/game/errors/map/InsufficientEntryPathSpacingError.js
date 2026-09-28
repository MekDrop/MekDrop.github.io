export class InsufficientEntryPathSpacingError extends Error {
  constructor() {
    super(
      "Map validation failed: parallel paths are separated by fewer than two full grass tiles.",
    );
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
