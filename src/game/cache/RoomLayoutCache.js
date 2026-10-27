import { ObjectDataCache } from "./ObjectDataCache.js";

/**
 * Baked furnishing recipes. Placement validation still runs for every room.
 */
export class RoomLayoutCache {
  /**
   * @type {boolean}
   */
  static enabled = true;

  /**
   * @param {import("../generator/castle/rooms/AbstractCastleRoomGenerator.js").AbstractCastleRoomGenerator} generator
   * @param {import("../generator/castle/rooms/AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @param {Record<string, import("./ObjectDataCache.js").CacheValue>} [context]
   * @returns {import("../generator/castle/rooms/AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  static resolve(generator, room, context) {
    const generate = () => generator.furnish(room, context);
    if (!this.enabled) {
      return generate();
    }

    return ObjectDataCache.resolve("room-layouts", {
      recipeVersion: 3,
      generator: generator.constructor.name,
      configuration: { ...generator },
      room,
      context,
    }, generate);
  }
}
