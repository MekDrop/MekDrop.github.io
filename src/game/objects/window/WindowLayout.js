import { InvalidWindowRangeError } from "../../errors/window/index.js";

/**
 * Window ranges use opposite corners, or level bottom edges with an explicit height.
 */
export class WindowLayout {
  /**
   * @param {import("../ObjectTypes.js").MapObjectDefinition} definition
   * @returns {{position: import("../ObjectTypes.js").Point3, width: number, height: number, depth: number, yaw: number, role: string}}
   */
  static bounds(definition) {
    const { from, to, facing = 1, depth = 0.3, variant = "room" } = definition;
    const alongX = from?.x !== to?.x;
    const alongZ = from?.z !== to?.z;
    const height = from && to ? (from.y === to.y ? definition.height : Math.abs(to.y - from.y)) : 0;
    if (!from || !to || ![from.x, from.y, from.z, to.x, to.y, to.z, height, depth].every(Number.isFinite) ||
      alongX === alongZ || height <= 0 || depth <= 0 || ![1, -1].includes(facing)) {
      throw new InvalidWindowRangeError(definition.id);
    }
    return {
      position: { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y), z: (from.z + to.z) / 2 },
      width: Math.abs(alongX ? to.x - from.x : to.z - from.z), height, depth,
      yaw: alongX ? (facing === 1 ? 0 : 180) : (facing === 1 ? 90 : -90), role: variant,
    };
  }
}
