import { RoomPlacementRules } from "../RoomPlacementRules.js";

/**
 * Low arrival furnishings beneath the entrance-side window.
 */
export class VestibuleWindowFurnishing {
  /**
   * @param {import("../AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @param {import("../AbstractCastleRoomGenerator.js").RoomItem[]} occupied
   * @param {Array} openings
   * @param {(item:import("../AbstractCastleRoomGenerator.js").RoomItem)=>boolean} safe
   * @param {number} wallThickness
   * @returns {import("../AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  static furnish(room, occupied, openings, safe, wallThickness) {
    const items = [];
    for (const window of openings.filter(/**
     * @param {import("../../CastleBasePlanGenerator.js").CompiledCastleOpening} opening
     */ opening =>
        opening.roomId === room.id && opening.kind === "window" && opening.axis === "x" &&
      opening.coordinate === room.minX && opening.floorY === room.floorY)) {
      const table = {
        id: `${room.id}-${room.level}-window-stand`,
        role: "vestibuleProp",
        object: "LibrarySideTable",
        x: room.minX + 0.39,
        z: Math.max(room.minZ + 1.2, Math.min(room.maxZ - 1.2, window.center)),
        width: 0.6162,
        depth: 0.684,
        height: 0.55,
        scale: 0.75,
        rotation: 90,
        y: 0.002,
      };
      const storage = {
        id: `${room.id}-${room.level}-arrival-storage`,
        role: "vestibuleProp",
        object: "WoodenStorageChest",
        x: room.minX + 0.48,
        z: window.center - 1.5,
        width: 0.55,
        depth: 0.7,
        height: 0.3291 * 1.5,
        scale: 1.2,
        stretch: {
          x: 1,
          y: 1.5,
          z: 1,
        },
        rotation: 90,
        y: 0.002,
        wallMountBack: -0.275,
      };
      const candidates = [table,
        {
          role: "vestibuleProp",
          object: "TerracePlanter",
          x: table.x,
          z: table.z,
          width: 0.745,
          depth: 0.745,
          height: 0.99,
          scale: 0.45,
          rotation: 90,
          y: 0.55 * table.scale + 0.002,
          supportId: table.id,
        },
        {
          role: "vestibuleProp",
          object: "Boots",
          x: table.x + 0.03,
          z: table.z,
          width: 0.5,
          depth: 0.7,
          height: 0.28,
          scale: 0.6,
          rotation: 90,
          y: 0.002,
          supportId: table.id,
          underSupport: true,
        },
        {
          role: "vestibuleProp",
          object: "VestibuleStickStand",
          x: table.x,
          z: table.z - 0.65,
          width: 0.36,
          depth: 0.36,
          height: 1.05,
          scale: 0.8,
          rotation: 90,
          y: 0.002,
        },
        {
          id: `${room.id}-${room.level}-arrival-shield`,
          role: "vestibuleProp",
          object: "WarCouncilShield",
          x: room.minX + 0.06,
          z: window.center - 1.5,
          width: 0.1,
          depth: 0.7,
          height: 0.85,
          scale: 1.1,
          rotation: 90,
          y: 1.25,
          wallAttachment: true,
        },
        storage,
        {
          role: "vestibuleProp",
          object: "FoldedLinens",
          x: storage.x,
          z: storage.z + 0.16,
          width: 0.22,
          depth: 0.3,
          height: 0.16,
          scale: 1.4,
          rotation: 90,
          y: storage.y + storage.height * storage.scale,
          supportId: storage.id,
        },
        {
          role: "vestibuleProp",
          object: "TableLantern",
          x: storage.x,
          z: storage.z - 0.25,
          width: 0.2136,
          depth: 0.22,
          height: 0.427,
          scale: 0.8,
          rotation: 90,
          y: storage.y + storage.height * storage.scale,
          supportId: storage.id,
        },
        {
          id: `${room.id}-${room.level}-arrival-rug`,
          role: "vestibuleProp",
          object: "Rug",
          model: "vestibule-runner.glb",
          x: room.minX + 1.05,
          z: table.z - 0.35,
          width: 1.5,
          depth: 2.5,
          height: 0.0306,
          scale: 1,
          stretch: {
            x: 1.5 / 1.3,
            y: 1,
            z: 2.5 / 3.3,
          },
          rotation: 0,
          y: 0.002,
          floorCovering: true,
        }];
      for (const item of candidates) {
        const obstacles = item.floorCovering ? [] : [...occupied, ...items];
        if (safe(item) && RoomPlacementRules.accepts(item, room, obstacles, wallThickness)) { items.push(item); }
      }
    }
    return items;
  }
}
