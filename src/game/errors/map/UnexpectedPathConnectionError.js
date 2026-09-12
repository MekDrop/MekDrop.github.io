export class UnexpectedPathConnectionError extends Error {
  constructor({ firstPathIndex, secondPathIndex, col, row }) {
    super(
      `Map validation failed: paths ${firstPathIndex} and ${secondPathIndex} connect outside their merge at (${col}, ${row}).`,
    );
    this.name = this.constructor.name;
  }
}
