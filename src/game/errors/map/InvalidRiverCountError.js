export class InvalidRiverCountError extends Error {
  constructor({ count, maximum }) {
    super(
      `Map validation failed: river count ${count} is outside the allowed range of 0 to ${maximum}.`,
    );
    this.name = this.constructor.name;
  }
}
