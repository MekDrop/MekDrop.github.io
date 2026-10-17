/**
 * @typedef {import("./AbstractCastleRoomGenerator.js").RoomItem} BookshelfItem
 * @typedef {{x:number,y:number,z:number,halfX:number,halfY:number,halfZ:number}} ShelfWall
 * @typedef {{minX:number,maxX:number,minZ:number,maxZ:number,bottom:number,top:number}} ReadingSpace
 */

/**
 * Wall-backed cabinets reserve a metre of usable space at their open face.
 */
export class BookshelfPlacementRules {
  /**
   * @param {BookshelfItem} item
   * @returns {boolean}
   */
  static isBookcase(item) {
    return item.object === "Shelf" && (item.variant ?? item.properties?.variant) !== "storage";
  }

  /**
   * @param {BookshelfItem} item
   * @param {ShelfWall[]} walls
   * @param {import("./AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @returns {{wall:ShelfWall,access:ReadingSpace}|null}
   */
  static placement(item, walls, room) {
    const bounds = room.wallBounds ?? room;
    const alongX = item.width >= item.depth;
    const axis = alongX ? "z" : "x";
    const tangent = alongX ? "x" : "z";
    const half = (alongX ? item.depth : item.width) * item.scale / 2;
    const length = (alongX ? item.width : item.depth) * item.scale / 2;
    const bottom = item.floorY ?? room.floorY ?? 0;
    for (const wall of walls) {
      const normalHalf = alongX ? wall.halfZ : wall.halfX;
      const tangentHalf = alongX ? wall.halfX : wall.halfZ;
      if (normalHalf > tangentHalf || bottom + 0.1 >= wall.y + wall.halfY ||
        bottom + Math.min(item.height ?? 1.35, 1.8) <= wall.y - wall.halfY) {
        continue;
      }
      const direction = item[axis] > wall[axis] ? 1 : -1;
      const face = wall[axis] + direction * normalHalf;
      const gap = direction * (item[axis] - direction * half - face);
      if (gap < 0.025 - 1e-6 || gap > 0.05 + 1e-6) {
        continue;
      }
      // Masonry is often split into individual blocks. A continuous row can
      // support a cabinet wider than any single block, but a doorway cannot.
      let low = wall[tangent] - tangentHalf;
      let high = wall[tangent] + tangentHalf;
      for (let pass = 0; pass < walls.length; pass++) {
        const previousLow = low;
        const previousHigh = high;
        for (const segment of walls) {
          const segmentNormalHalf = alongX ? segment.halfZ : segment.halfX;
          const segmentTangentHalf = alongX ? segment.halfX : segment.halfZ;
          if (Math.abs(segment[axis] + direction * segmentNormalHalf - face) > 0.005 ||
            bottom + 0.1 >= segment.y + segment.halfY || bottom + 0.1 < segment.y - segment.halfY ||
            segment[tangent] + segmentTangentHalf < low - 1e-6 ||
            segment[tangent] - segmentTangentHalf > high + 1e-6) {
            continue;
          }
          low = Math.min(low, segment[tangent] - segmentTangentHalf);
          high = Math.max(high, segment[tangent] + segmentTangentHalf);
        }
        if (low === previousLow && high === previousHigh) {
          break;
        }
      }
      if (item[tangent] - length < low - 1e-6 || item[tangent] + length > high + 1e-6) {
        continue;
      }
      const front = item[axis] + direction * half;
      const center = front + direction * 0.5;
      const access = {
        minX: alongX ? item.x - length : center - 0.5,
        maxX: alongX ? item.x + length : center + 0.5,
        minZ: alongX ? center - 0.5 : item.z - length,
        maxZ: alongX ? center + 0.5 : item.z + length,
        bottom: bottom + 0.05,
        top: bottom + 1.8,
      };
      if (access.minX < bounds.minX - 1e-6 || access.maxX > bounds.maxX + 1e-6 ||
        access.minZ < bounds.minZ - 1e-6 || access.maxZ > bounds.maxZ + 1e-6) {
        continue;
      }

      return {
        wall,
        access,
      };
    }

    return null;
  }
}
