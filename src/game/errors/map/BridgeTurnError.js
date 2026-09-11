export class BridgeTurnError extends Error {
  constructor({ col, row }) {
    super(
      `Map validation failed: bridge at (${col}, ${row}) connects to a perpendicular bridge segment.`,
    );
    this.name = this.constructor.name;
  }
}
