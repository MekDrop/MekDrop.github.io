export class InvalidStonePlacementError extends Error {
  constructor({ col, row }) {
    super(
      `Map validation failed: stone cluster at (${col}, ${row}) is not on clear flat grass or has invalid parts.`,
    );
    this.name = this.constructor.name;
  }
}
