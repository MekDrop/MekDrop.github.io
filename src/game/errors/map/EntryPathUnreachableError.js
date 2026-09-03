export class EntryPathUnreachableError extends Error {
  constructor() {
    super("Map validation failed: an entry path does not reach the castle.");
    this.name = this.constructor.name;
  }
}
