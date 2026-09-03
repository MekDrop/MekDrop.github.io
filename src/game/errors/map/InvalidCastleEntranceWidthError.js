export class InvalidCastleEntranceWidthError extends Error {
  constructor() {
    super(
      "Map validation failed: the castle entrance must cover both full-width path lanes.",
    );
    this.name = this.constructor.name;
  }
}
