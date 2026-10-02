/**
 * Plans entrances into the shared circulation space on every occupied floor.
 * Rear ground rooms also enter from the side aisles beside the throne room.
 * @param {{placedRooms:import("./rooms/AbstractCastleRoomGenerator.js").PlannedCastleRoom[],shaft:{minZ:number,maxZ:number},rise:number}} plan
 * @returns {Array<{roomId:string,axis:string,coordinate:number,center:number,width:number,floorY:number}>}
 */
export function createCastleRoomDoorways(plan) {
  const result = [];
  for (const room of plan.placedRooms) {
    const x = (room.minX + room.maxX) / 2;
    const z = (room.minZ + room.maxZ) / 2;
    if (room.id === "throneRoom") {
      result.push({ roomId: room.id, axis: "z", coordinate: room.minZ - 0.125, center: 0, width: 1.2, floorY: room.floorY });
      for (const coordinate of [room.minX - 0.125, room.maxX + 0.125]) {
        result.push({ roomId: room.id, axis: "x", coordinate, center: room.minZ + 0.6, width: 1.2, floorY: room.floorY });
      }
      continue;
    }
    if (room.level === 1 && !room.id.startsWith("tower")) {
      // Upper chambers open onto the broad rear landing rather than a side slot.
      result.push({ roomId: room.id, axis: "z", coordinate: room.maxZ + 0.125,
        center: Math.max(room.minX + 0.75, Math.min(room.maxX - 0.75, x + (plan.shaft.minX < 0 ? 0.5 : -0.5))), width: 1, floorY: room.floorY });
      continue;
    }
    const side = x < 0 ? room.maxX + 0.125 : room.minX - 0.125;
    const approachX = side + (x < 0 ? 0.6 : -0.6);
    const centers = [];
    for (let center = room.minZ + 0.75; center <= room.maxZ - 0.75; center += 0.25) centers.push(center);
    centers.sort(/**
     *
     * @param {number} a
     * @param {number} b
     */
    (a, b) => Math.abs(a - z) - Math.abs(b - z));
    const clearCenter = centers.find(/**
     *
     * @param {number} center
     */
    (center) => !plan.placedRooms.some(/**
     *
     * @param {import("./rooms/AbstractCastleRoomGenerator.js").PlannedCastleRoom} other
     */
    (other) => other !== room &&
      other.level <= room.level && other.level + other.floorSpan > room.level &&
      approachX > other.minX - 0.525 && approachX < other.maxX + 0.525 &&
      center > other.minZ - 0.525 && center < other.maxZ + 0.525)) ?? z;
    for (let floor = 0; floor < room.floorSpan; floor++) {
      const openLanding = room.stairHost && floor > 0;
      const shaftCenterZ = (plan.shaft.minZ + plan.shaft.maxZ) / 2;
      const landingMinZ = x < 0 ? shaftCenterZ - 0.2 : plan.shaft.minZ + 0.25;
      const landingMaxZ = x < 0 ? plan.shaft.maxZ - 0.25 : shaftCenterZ + 0.2;
      result.push({ roomId: room.id, axis: "x", coordinate: side,
        center: openLanding ? (landingMinZ + landingMaxZ) / 2 : room.stairHost ? plan.shaft.minZ : clearCenter,
        width: openLanding ? Math.min(1.25, landingMaxZ - landingMinZ) : Math.min(1.2, room.maxZ - room.minZ - 0.5),
        floorY: room.floorY + floor * plan.rise });
    }
    if (room.level === 0 && !room.id.startsWith("tower")) {
      result.push({ roomId: room.id, axis: "z", coordinate: room.minZ - 0.125,
        center: room.stairHost ? x < 0 ? room.minX + 0.9 : room.maxX - 0.9 : x, width: Math.min(1.2, room.maxX - room.minX - 0.5), floorY: room.floorY });
    }
  }
  // Aperture edges align with voxel edges. The visual leaf and its collider
  // use exactly the same width and center as the masonry opening.
  for (const doorway of result) {
    const blocks = Math.round(doorway.width * 4);
    doorway.width = blocks / 4;
    const offset = blocks % 2 ? 0.125 : 0;
    doorway.center = Math.round((doorway.center - offset) * 4) / 4 + offset;
  }
  return result;
}
