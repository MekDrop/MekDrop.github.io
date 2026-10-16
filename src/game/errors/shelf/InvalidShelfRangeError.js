/**
 * Invalid axis-aligned bookshelf extent.
 */
export class InvalidShelfRangeError extends Error {
  /**
   * @param {string} id
   */
  constructor(id) {
    super(`Shelf ${id} requires finite, level endpoints along exactly one ground axis and a positive height.`);

    this.name = "InvalidShelfRangeError";
  }
}
