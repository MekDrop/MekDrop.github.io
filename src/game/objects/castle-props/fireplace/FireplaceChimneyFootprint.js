/**
 * Plan-space reservation of the authored chimney courses above a hearth.
 */
export class FireplaceChimneyFootprint {
  /**
   * @param {import("../../../generator/castle/rooms/AbstractCastleRoomGenerator.js").RoomItem} item
   * @param {import("../../../generator/castle/rooms/AbstractCastleRoomGenerator.js").PlannedCastleRoom[]} rooms
   * @param {number} [rotationCorrection] Model correction after authored plan transforms.
   * @returns {{minX:number,maxX:number,minZ:number,maxZ:number,bottom:number,top:number,masonry:boolean,chimney:boolean}}
   */
  static bounds(item, rooms, rotationCorrection = 180) {
    const scale = item.scale ?? 1;
    // Authored castle props publish layout yaw + 180 + item rotation.
    const angle = ((item.rotation ?? 0) + rotationCorrection) * Math.PI / 180;
    const sine = Math.sin(angle), cosine = Math.cos(angle);
    const x = item.x + (cosine * 0.028 - sine * 0.2073) * scale;
    const z = item.z - (sine * 0.028 + cosine * 0.2073) * scale;
    const halfX = (Math.abs(cosine) * 0.29 + Math.abs(sine) * 0.2) * scale;
    const halfZ = (Math.abs(sine) * 0.29 + Math.abs(cosine) * 0.2) * scale;
    const base = item.floorY + (item.y ?? 0);
    let top = base + (item.chimneyHeight ?? 1.65 * scale);
    for (const room of rooms) {
      if (room.maxX < x - halfX || room.minX > x + halfX ||
        room.maxZ < z - halfZ || room.minZ > z + halfZ || room.floorY < base) {
        continue;
      }
      top = Math.max(top, room.floorY + (room.height ?? 3) + 0.72);
    }

    return {
      minX: x - halfX,
      maxX: x + halfX,
      minZ: z - halfZ,
      maxZ: z + halfZ,
      bottom: base + 1.65 * scale,
      top,
      masonry: false,
      chimney: true,
    };
  }
}
