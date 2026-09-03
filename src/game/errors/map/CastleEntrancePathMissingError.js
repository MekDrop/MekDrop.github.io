export class CastleEntrancePathMissingError extends Error {
  constructor() {
    super(
      "Map validation failed: the final path does not end at the castle entrance.",
    );
    this.name = this.constructor.name;
  }
}
