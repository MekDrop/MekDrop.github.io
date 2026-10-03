/**
 * Resolves overlapping room volumes using the highest floor beneath the hero.
 */
export class CastleRoomLocator {
  /**
   * @param {import("../../../../GameContracts.js").CastleBuildPlan["metadata"]["runtime"]["residential"]} plan
   * @param {{x:number,y:number,z:number}} position
   * @returns {import("../../../../generator/castle/rooms/AbstractCastleRoomGenerator.js").PlannedCastleRoom|null}
   */
  static locate(plan, position) {
    const angle = (plan.origin.yaw ?? 0) * Math.PI / 180;
    const dx = position.x - plan.origin.x;
    const dz = position.z - plan.origin.z;
    const x = Math.cos(angle) * dx - Math.sin(angle) * dz;
    const z = Math.sin(angle) * dx + Math.cos(angle) * dz;
    const spaces = plan.spaces ?? plan.placedRooms ?? Object.values(plan.rooms ?? {});
    let room = null;
    for (const space of spaces) {
      // Floor finishes and collision slabs can put the feet just below floorY.
      if (space.kind === "void" || x < space.minX || x > space.maxX ||
        z < space.minZ || z > space.maxZ || position.y < space.floorY - 0.35 ||
        position.y >= space.floorY + (space.height ?? plan.floorHeight ?? plan.rise ?? 2.25)) {
        continue;
      }
      if (!room || space.floorY > room.floorY) {
        room = space;
      }
    }
    return room;
  }
}
