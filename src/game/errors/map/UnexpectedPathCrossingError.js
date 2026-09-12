export class UnexpectedPathCrossingError extends Error {
  constructor({ col, row }) {
    super(
      `Map validation failed: paths form an unplanned flat crossing at (${col}, ${row}).`,
    );
    this.name = this.constructor.name;
  }
}
