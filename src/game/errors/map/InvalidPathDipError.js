export class InvalidPathDipError extends Error {
  constructor({ id, reason }) {
    super(`Map validation failed: terrain path dip ${id} ${reason}.`);
    this.name = "InvalidPathDipError";
  }
}
