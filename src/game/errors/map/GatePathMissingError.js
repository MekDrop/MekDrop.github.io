export class GatePathMissingError extends Error {
  constructor() {
    super("Map validation failed: gate does not connect to a valid path.");
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
