export class GateRouteMissingError extends Error {
  constructor() {
    super("Map routing failed: a gate has no quickest route to the castle.");
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
