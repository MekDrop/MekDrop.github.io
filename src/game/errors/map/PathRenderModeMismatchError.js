export class PathRenderModeMismatchError extends Error {
  constructor({ col, row, expected, actual }) {
    super(
      `Map validation failed: path tile at (${col}, ${row}) must render as ${expected}, not ${actual}.`,
    );
    this.name = this.constructor.name;
  }
}
