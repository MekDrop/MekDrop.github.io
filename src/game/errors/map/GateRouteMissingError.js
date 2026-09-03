export class GateRouteMissingError extends Error {
  constructor() {
    super("Map routing failed: a gate has no quickest route to the castle.");
    this.name = this.constructor.name;
  }
}
