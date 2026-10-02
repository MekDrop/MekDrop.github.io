export class CastleRoomSizeInvalidError extends Error {
  /**
   * @param {string} id
   */
  constructor(id) {
    super(`Castle room ${id} requires positive minimum dimensions and maximum dimensions no smaller than its minimum.`);
    this.name = "CastleRoomSizeInvalidError";
  }
}
