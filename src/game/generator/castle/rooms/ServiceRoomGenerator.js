import { AbstractCastleRoomGenerator } from "./AbstractCastleRoomGenerator.js";

export class ServiceRoomGenerator extends AbstractCastleRoomGenerator {
  constructor() { super("service", { x: 2, y: 2.5 }, { x: 4, y: 8 }); }
  /**
   * @returns {number[]}
   */
  get levels() { return [0, -1]; }
  /**
   * @param {import("./AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @returns {import("./AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  furnish(room) {
    return [
      { role: "servantBed", x: room.minX < 0 ? room.minX + 0.5 : room.maxX - 0.5, z: room.maxZ - 0.9, width: 0.8, depth: 1.6, scale: 0.8 },
      { role: "kitchenTable", x: room.maxX - 0.5, z: room.minZ + 0.6, width: 0.9, depth: 0.55, scale: 0.75 },
      { role: "storageShelf", x: room.minX + 0.5, z: room.minZ + 0.4, width: 0.8, depth: 0.3, scale: 0.75 },
    ];
  }
}
