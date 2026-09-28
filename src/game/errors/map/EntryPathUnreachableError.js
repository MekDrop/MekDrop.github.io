export class EntryPathUnreachableError extends Error {
  constructor() {
    super("Map validation failed: an entry path does not reach the castle.");
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
