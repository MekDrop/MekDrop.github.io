import { AbstractCastleRoomGenerator } from "./AbstractCastleRoomGenerator.js";

/**
 * Stores spare terrace equipment along the walls, with the tea set on its table.
 */
export class TerraceStorageRoomGenerator extends AbstractCastleRoomGenerator {
  constructor() { super("terraceStorage", { x: 3.25, y: 3.75 }); }

  /**
   * @param {import("./AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @returns {import("./AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  furnish(room) {
    if (room.maxX - room.minX < this.min.x || room.maxZ - room.minZ < this.min.y) { return []; }
    const storageScale = 0.65;
    const tableX = room.maxX - 0.1 - 0.625 * storageScale;
    const tableZ = room.minZ + 0.1 + 0.625 * storageScale;
    const definitions = [
      // The north-west opening belongs to the neighbouring kitchen. Keep its
      // approach clear even though storage itself authors no door openings.
      ["TerraceSunbed", room.minX + 0.1 + 0.655 * storageScale, room.maxZ - 0.1 - 0.582 * storageScale, 1.31, 1.164, 0.76, 1, 0],
      ["TeaTable", tableX, tableZ, 1.25, 1.25, 1.075, 1, 0],
      ["TerraceTeaChair", room.minX + 0.1 + 0.375 * storageScale, room.minZ + 1.6, 0.75, 0.77, 1.668, 1, 0.003],
      ["TerraceServingTray", tableX, tableZ - 0.28, 1.24, 0.604, 0.128, 1, 1.075],
      ["TerraceTeapot", tableX - 0.2, tableZ - 0.28, 0.83, 0.38, 0.472, 1, 1.11],
      ["TerraceTeacup", tableX + 0.37, tableZ - 0.28, 0.482, 0.362, 0.217, 1, 1.11],
      ["TerraceReadingBook", tableX, tableZ + 0.24, 0.619, 0.69, 0.164, 0.6, 1.075],
    ];
    return definitions.map(/**
     * @param {Array<string|number>} definition
     * @param {number} index
     */
    ([object, x, z, width, depth, height, scale, y], index) => ({
      role: "serviceProp", object,
      x: index >= 3 ? tableX + (x - tableX) * storageScale : x,
      z: index >= 3 ? tableZ + (z - tableZ) * storageScale : z,
      width, depth, height, scale: scale * storageScale, y: y * storageScale,
      rotation: index === 0 ? 90 : 0,
      id: `${room.id}-terrace-storage-${index}`,
      ...(index >= 3 ? { supportId: `${room.id}-terrace-storage-${index === 4 || index === 5 ? 3 : 1}` } : {}),
    }));
  }
}
