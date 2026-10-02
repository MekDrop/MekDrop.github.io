/**
 * Invalid axis-aligned bookshelf extent.
 */
export class InvalidBookshelfRangeError extends Error {
  /**
   * @param {string} id
   */
  constructor(id) {
    super(`Bookshelf ${id} requires finite, level endpoints along exactly one ground axis and a positive height.`);
    this.name = "InvalidBookshelfRangeError";
  }
}
