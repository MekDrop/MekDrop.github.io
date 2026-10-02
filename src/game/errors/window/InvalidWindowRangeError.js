/**
 * Invalid axis-aligned window extent.
 */
export class InvalidWindowRangeError extends Error {
  /**
   * @param {string} id
   */
  constructor(id) {
    super(`Window ${id} requires finite endpoints along exactly one ground axis, positive height and depth, and facing 1 or -1.`);
    this.name = "InvalidWindowRangeError";
  }
}
