export class CastleGenerationAbortedError extends Error {
  constructor() {
    super("Castle generation was aborted.");
    this.name = this.constructor.name;
  }
}
