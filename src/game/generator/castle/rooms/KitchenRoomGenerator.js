import { AbstractCastleRoomGenerator } from "./AbstractCastleRoomGenerator.js";

export class KitchenRoomGenerator extends AbstractCastleRoomGenerator {
  constructor() { super("kitchen", { x: 2, y: 2.5 }); }
  /**
   * @returns {number[]}
   */
  get levels() { return [-1, 0]; }
  /**
   * Keep the east service-door aisle clear in the compact kitchen.
   * @param {import("./AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @returns {import("./AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  furnish(room) {
    return [
      { role: "kitchenTable", x: room.minX + 0.5, z: room.minZ + 0.6, width: 0.9, depth: 0.55, scale: 0.75 },
      { role: "storageShelf", x: room.minX + 0.5, z: room.maxZ - 0.4, width: 0.8, depth: 0.3, scale: 0.75 },
    ];
  }
}
