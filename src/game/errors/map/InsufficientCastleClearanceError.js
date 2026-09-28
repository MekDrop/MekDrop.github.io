export class InsufficientCastleClearanceError extends Error {
  constructor() {
    super("Map validation failed: the castle is too close to an island edge.");
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
