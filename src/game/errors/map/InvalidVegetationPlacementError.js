export class InvalidVegetationPlacementError extends Error {
  constructor({ col, row, reason }) {
    super(
      `Map validation failed: vegetation at (${col}, ${row}) ${reason}.`,
    );
    this.name = this.constructor.name;
  }
}
