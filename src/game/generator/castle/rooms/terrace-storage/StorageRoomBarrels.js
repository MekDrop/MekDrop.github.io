import { RoomFurnishingChoices } from "../RoomFurnishingChoices.js";
import { RoomPlacementRules } from "../RoomPlacementRules.js";

/**
 * @typedef {{seed?:string|number,wallThickness?:number,openings?:import("../../CastleBasePlanGenerator.js").CompiledCastleOpening[],stairs?:Array<{minX:number,maxX:number,minZ:number,maxZ:number,from:number,to:number}>}} StorageContext
 */

/**
 * Optional wall-side supplies, with an adult-width route through the storeroom.
 */
export class StorageRoomBarrels {
  /**
   * @param {import("../AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @param {import("../AbstractCastleRoomGenerator.js").RoomItem[]} occupied
   * @param {StorageContext} context
   * @returns {import("../AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  static furnish(room, occupied, context) {
    const seed = context.seed ?? room.furnishingSeed ?? 0;
    const wanted = RoomFurnishingChoices.order([0, 0, 1, 2, 3], room, "spare-barrel-count", seed)[0];
    const items = [];
    const inset = (context.wallThickness ?? 0.25) / 2 + 0.03;
    const half = 0.554 / 2;
    const candidates = [];
    for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
      const x = room.minX + inset + half + fraction * (room.maxX - room.minX - 2 * (inset + half));
      const z = room.minZ + inset + half + fraction * (room.maxZ - room.minZ - 2 * (inset + half));
      candidates.push([x, room.minZ + inset + half], [x, room.maxZ - inset - half],
        [room.minX + inset + half, z], [room.maxX - inset - half, z]);
    }
    for (const [x, z] of RoomFurnishingChoices.order(candidates, room, "spare-barrel-wall", seed)) {
      if (items.length >= wanted) {
        break;
      }
      const barrel = {
        id: `${room.id}-spare-barrel-${items.length}`,
        role: "serviceProp",
        object: "Barrel",
        x,
        z,
        width: 0.554,
        depth: 0.554,
        height: 0.65,
        scale: 1,
        rotation: 0,
        y: 0.002,
        properties: {
          weathering: 0.45,
        },
      };
      const all = [...occupied, ...items];
      if (!RoomPlacementRules.accepts(barrel, room, all, context.wallThickness) ||
        !StorageRoomBarrels.#clearApproaches(barrel, room, context) ||
        !StorageRoomBarrels.#connected(room, [...all, barrel], context)) {
        continue;
      }
      items.push(barrel);
    }

    return items;
  }

  /**
   * @param {import("../AbstractCastleRoomGenerator.js").RoomItem} barrel
   * @param {import("../AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @param {StorageContext} context
   * @returns {boolean}
   */
  static #clearApproaches(barrel, room, context) {
    const half = barrel.width / 2;
    const dx = Math.max(0, Math.abs(barrel.x - (room.minX + room.maxX) / 2) - half);
    const dz = Math.max(0, Math.abs(barrel.z - (room.minZ + room.maxZ) / 2) - half);
    if (Math.hypot(dx, dz) < 0.5) {
      return false;
    }
    for (const opening of context.openings ?? []) {
      if (opening.floorY !== room.floorY || opening.kind !== "door") {
        continue;
      }
      const normal = Math.abs((opening.axis === "x" ? barrel.x : barrel.z) - opening.coordinate);
      const along = Math.abs((opening.axis === "x" ? barrel.z : barrel.x) - opening.center);
      if (normal < half + opening.width + 0.3 && along < half + opening.width / 2 + 0.35) {
        return false;
      }
    }
    for (const stair of context.stairs ?? []) {
      if (room.level < stair.from || room.level > stair.to) {
        continue;
      }
      if (barrel.x + half > stair.minX - 0.35 && barrel.x - half < stair.maxX + 0.35 &&
        barrel.z + half > stair.minZ - 0.35 && barrel.z - half < stair.maxZ + 0.35) {
        return false;
      }
    }

    return true;
  }

  /**
   * Flood the usable floor with a 60 cm actor envelope, including the fixed kit.
   * @param {import("../AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @param {import("../AbstractCastleRoomGenerator.js").RoomItem[]} items
   * @param {StorageContext} context
   * @returns {boolean}
   */
  static #connected(room, items, context) {
    const columns = Math.ceil((room.maxX - room.minX - 0.6) / 0.18);
    const rows = Math.ceil((room.maxZ - room.minZ - 0.6) / 0.18);
    const free = new Set();
    for (let row = 0; row <= rows; row++) {
      const z = room.minZ + 0.3 + row / rows * (room.maxZ - room.minZ - 0.6);
      for (let column = 0; column <= columns; column++) {
        const x = room.minX + 0.3 + column / columns * (room.maxX - room.minX - 0.6);
        let blocked = false;
        for (const stair of context.stairs ?? []) {
          if (room.level >= stair.from && room.level <= stair.to &&
            x > stair.minX - 0.3 && x < stair.maxX + 0.3 &&
            z > stair.minZ - 0.3 && z < stair.maxZ + 0.3) {
            blocked = true;
            break;
          }
        }
        for (const item of items) {
          if (item.supportId || item.floorCovering || (item.y ?? 0) > 1.5) {
            continue;
          }
          if (Math.abs(x - item.x) < item.width * item.scale / 2 + 0.3 &&
            Math.abs(z - item.z) < item.depth * item.scale / 2 + 0.3) {
            blocked = true;
            break;
          }
        }
        if (!blocked) {
          free.add(row * (columns + 1) + column);
        }
      }
    }
    const first = free.values().next().value;
    if (first === undefined) {
      return false;
    }
    const queue = [first];
    const visited = new Set(queue);
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const index = queue[cursor];
      for (const next of [index - columns - 1, index + columns + 1,
        ...(index % (columns + 1) ? [index - 1] : []),
        ...(index % (columns + 1) < columns ? [index + 1] : [])]) {
        if (free.has(next) && !visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }

    return visited.size === free.size;
  }
}
