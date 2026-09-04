export class InvalidGroundCoverPlacementError extends Error {
  constructor({ col, row, reason }) {
    super(
      `Map validation failed: ground cover at (${col}, ${row}) ${reason}.`,
    );
    this.name = this.constructor.name;
  }
}
