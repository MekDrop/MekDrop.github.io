import { RoomPlacementRules } from "../RoomPlacementRules.js";

/**
 * A console and coat hooks give the long arrival wall a useful furnished bay.
 */
export class VestibuleWallFurnishing {
  /**
   * @param {import("../AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @param {import("../AbstractCastleRoomGenerator.js").RoomItem[]} occupied
   * @param {(item:import("../AbstractCastleRoomGenerator.js").RoomItem)=>boolean} safe
   * @param {number} wallThickness
   * @returns {import("../AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  static furnish(room, occupied, safe, wallThickness) {
    const alongX = room.maxX - room.minX >= room.maxZ - room.minZ;
    const length = alongX ? room.maxX - room.minX : room.maxZ - room.minZ;
    const breadth = alongX ? room.maxZ - room.minZ : room.maxX - room.minX;
    if (length < 4 || breadth < 3.3) { return []; }
    for (const fraction of [0.5, 0.55, 0.45, 0.6, 0.4, 0.65, 0.35, 0.75, 0.25]) {
      const x = alongX ? room.minX + length * fraction : room.maxX - 0.375;
      const z = alongX ? room.maxZ - 0.375 : room.minZ + length * fraction;
      const rotation = alongX ? 180 : 270;
      const console = {
        id: `${room.id}-${room.level}-arrival-console`,
        role: "vestibuleProp",
        object: "WritingDesk",
        x,
        z,
        width: alongX ? 1.6 : 0.45,
        depth: alongX ? 0.45 : 1.6,
        height: 0.75,
        scale: 1,
        stretch: {
          x: 1.6 / 0.9,
          y: 0.75 / 0.65,
          z: 0.45 / 0.55,
        },
        wallMountBack: -0.275,
        rotation,
        y: 0.002,
      };
      if (!safe(console) || !RoomPlacementRules.accepts(console, room, occupied, wallThickness)) { continue; }
      const items = [console];
      const rail = {
        id: `${console.id}-hooks`,
        role: "vestibuleProp",
        object: "VestibuleCloakRail",
        x: alongX ? x : room.maxX - 0.09,
        z: alongX ? room.maxZ - 0.09 : z,
        width: alongX ? 1.1 : 0.1771,
        depth: alongX ? 0.1771 : 1.1,
        height: 1.365,
        scale: 0.78,
        rotation,
        y: 1.4,
        wallAttachment: true,
      };
      if (safe(rail) && RoomPlacementRules.accepts(rail, room, [...occupied, ...items], wallThickness)) { items.push(rail); }
      for (const [object, offset, width, depth, height, scale] of [
        ["TableLantern", -0.35, 0.22, 0.2136, 0.427, 0.8],
        ["Planter", 0.35, 0.745, 0.745, 0.99, 0.27],
      ]) {
        const item = {
          role: "vestibuleProp",
          object,
          x: x + (alongX ? offset : -0.05),
          z: z + (alongX ? -0.05 : offset),
          width,
          depth,
          height,
          scale,
          rotation,
          y: 0.752,
          supportId: console.id,
        };
        if (safe(item) && RoomPlacementRules.accepts(item, room, [...occupied, ...items], wallThickness)) { items.push(item); }
      }

      return items;
    }

    return [];
  }
}
