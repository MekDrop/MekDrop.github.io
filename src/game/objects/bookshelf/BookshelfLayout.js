import { InvalidBookshelfRangeError } from "../../errors/bookshelf/index.js";

/**
 * Coordinate ranges describe the outer shelf edges; the fixed axis is its centerline.
 */
export class BookshelfLayout {
  /**
   * @returns {number}
   */
  static get depth() { return 0.36; }

  /**
   * @param {import("../ObjectTypes.js").MapObjectDefinition} definition
   * @returns {{x: number, y: number, z: number, width: number, height: number, depth: number, length: number, rotation: number}}
   */
  static bounds(definition) {
    const { from, to, height = 1.8, facing = 1 } = definition;
    const alongX = from?.x !== to?.x;
    const alongZ = from?.z !== to?.z;
    if (!from || !to || ![from.x, from.y, from.z, to.x, to.y, to.z, height].every(Number.isFinite) ||
      from.y !== to.y || alongX === alongZ || height <= 0 || ![1, -1].includes(facing)) {
      throw new InvalidBookshelfRangeError(definition.id);
    }
    const length = Math.abs(alongX ? to.x - from.x : to.z - from.z);
    return {
      x: (from.x + to.x) / 2, y: from.y + height / 2, z: (from.z + to.z) / 2,
      width: alongX ? length : this.depth, height, depth: alongX ? this.depth : length,
      length, rotation: alongX ? (facing === 1 ? 0 : 180) : (facing === 1 ? 90 : -90),
    };
  }
}
