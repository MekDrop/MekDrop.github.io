/**
 * Requires uninterrupted masonry behind the hearth and its rising chimney.
 */
export class FireplaceWallBacking {
  /**
   * @param {import("./AbstractCastleRoomGenerator.js").RoomItem} item
   * @param {import("./AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @param {import("../CastleBasePlanGenerator.js").CompiledCastleOpening[]} openings
   * @param {Array<{x:number,y:number,z:number,halfX:number,halfY:number,halfZ:number}>} [walls]
   * @param {import("./AbstractCastleRoomGenerator.js").RoomItem} [original]
   * @returns {boolean}
   */
  static accepts(item, room, openings = [], walls, original = item) {
    const bounds = room.wallBounds ?? room;
    const crosswise = original.width < original.depth;
    const axis = crosswise ? "x" : "z";
    const low = crosswise ? bounds.minX : bounds.minZ;
    const high = crosswise ? bounds.maxX : bounds.maxZ;
    const coordinate = Math.abs(original[axis] - low) < Math.abs(original[axis] - high) ? low : high;
    const halfNormal = (crosswise ? item.width : item.depth) * item.scale / 2;
    const halfAlong = (crosswise ? item.depth : item.width) * item.scale / 2;
    const center = crosswise ? item.z : item.x;
    const alongLow = crosswise ? bounds.minZ : bounds.minX;
    const alongHigh = crosswise ? bounds.maxZ : bounds.maxX;
    if (Math.abs(item[axis] - coordinate) > halfNormal + 0.15 ||
      center - halfAlong < alongLow || center + halfAlong > alongHigh) { return false; }
    const bottom = room.floorY + (item.y ?? 0);
    const top = room.floorY + (room.height ?? 3);
    for (const opening of openings) {
      if (!["door", "window"].includes(opening.kind) || opening.floorY !== room.floorY || opening.axis !== axis ||
        Math.abs(opening.coordinate - coordinate) > 0.275) { continue; }
      const openingBottom = opening.floorY + (opening.bottom ?? 0);
      const openingTop = openingBottom + (opening.height ?? 2.5);
      if (openingBottom < top && openingTop > bottom &&
        Math.abs(center - opening.center) < halfAlong + opening.width / 2 + 0.08) { return false; }
    }
    if (!walls) { return true; }
    // Sample more densely than the quarter-metre masonry grid, including both
    // edges; an opening or a missing wall cannot count as backing.
    const columns = Math.ceil(halfAlong * 2 / 0.125);
    const rows = Math.ceil((top - bottom - 0.2) / 0.125);
    for (let column = 0; column <= columns; column++) {
      const along = center - halfAlong + 0.02 + column / columns * (halfAlong * 2 - 0.04);
      for (let row = 0; row <= rows; row++) {
        const y = bottom + 0.1 + row / rows * (top - bottom - 0.2);
        /**
         * @param {{x:number,y:number,z:number,halfX:number,halfY:number,halfZ:number}} wall
         */
        const supportsBackingPoint = wall => Math.abs(coordinate - wall[axis]) <= (crosswise ? wall.halfX : wall.halfZ) + 0.14 &&
          Math.abs(along - (crosswise ? wall.z : wall.x)) <= (crosswise ? wall.halfZ : wall.halfX) + 1e-6 &&
          Math.abs(y - wall.y) <= wall.halfY + 1e-6;
        if (!walls.some(supportsBackingPoint)) { return false; }
      }
    }
    return true;
  }
}
