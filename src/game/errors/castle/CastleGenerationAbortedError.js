export class CastleGenerationAbortedError extends Error {
  constructor() {
    super("Castle generation was aborted.");
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
