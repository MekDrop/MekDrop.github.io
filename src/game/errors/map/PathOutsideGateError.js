export class PathOutsideGateError extends Error {
  constructor() {
    super("Map validation failed: normal path tiles appear outside a gate.");
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
