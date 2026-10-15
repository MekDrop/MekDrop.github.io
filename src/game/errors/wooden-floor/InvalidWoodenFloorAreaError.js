/**
 * Invalid rectangle supplied to a timber floor.
 */
export class InvalidWoodenFloorAreaError extends Error {
  /**
   * @param {string} id
   */
  constructor(id) {
    super(`Wooden floor ${id} requires finite, level opposite corners with positive width and depth.`);

    this.name = "InvalidWoodenFloorAreaError";
  }
}
