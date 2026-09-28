export class CastlePlacementError extends Error {
  constructor() {
    super(
      "Castle placement failed: no castle style can preserve every full-width door.",
    );
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
