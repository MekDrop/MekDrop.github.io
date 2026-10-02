import { AbstractCastleRoomGenerator } from "./AbstractCastleRoomGenerator.js";

export class LibraryRoomGenerator extends AbstractCastleRoomGenerator {
  constructor() { super("library", { x: 1.75, y: 2 }, { x: 6, y: 4.5 }); }
  /**
   * @param {import("./AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @returns {import("./AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  furnish(room) {
    const x = room.maxX - 0.55;
    return [
      { role: "workDesk", x, z: room.minZ + 0.35, width: 0.9, depth: 0.55, scale: 0.8 },
      { role: "bookshelf", x: room.minX + 0.3, z: room.minZ + 0.35, width: 0.5, depth: 0.8, scale: 0.8 },
    ];
  }
}

