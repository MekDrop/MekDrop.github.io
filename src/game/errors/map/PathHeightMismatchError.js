export class PathHeightMismatchError extends Error {
  constructor() {
    super("Map validation failed: paired path lanes differ in height or slope.");
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
