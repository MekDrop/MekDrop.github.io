import { AbstractCastleRoomGenerator } from "./AbstractCastleRoomGenerator.js";

export class KitchenRoomGenerator extends AbstractCastleRoomGenerator {
  constructor() { super("kitchen", { x: 2, y: 2.5 }); }
  /**
   * @returns {number[]}
   */
  get levels() { return [-1, 0]; }
  /**
   * Keep the service-door aisle clear in the compact kitchen.
   * @param {import("./AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @param {{seed?:string|number,openings?:Array,stairs?:Array,wallThickness?:number}} [context]
   * @returns {import("./AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  furnish(room, context = {}) {
    let state = 2166136261;
    for (const character of `${context.seed ?? room.furnishingSeed ?? 0}:${room.id}:kitchen`) {
      state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
    }
    /**
     * @returns {number}
     */
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const width = room.maxX - room.minX;
    const depth = room.maxZ - room.minZ;
    const items = [];
    const inset = (context.wallThickness ?? 0.25) / 2 + 0.025;
    /**
     * @param {number} x
     * @param {number} z
     * @param {number} w
     * @param {number} d
     * @param {number} [margin]
     * @param {import("./AbstractCastleRoomGenerator.js").PlannedCastleRoom} [bounds]
     * @returns {boolean}
     */
    const available = (x, z, w, d, margin = inset, bounds = room) => {
      if (x - w / 2 < bounds.minX + margin - 0.000001 || x + w / 2 > bounds.maxX - margin + 0.000001 ||
        z - d / 2 < bounds.minZ + margin - 0.000001 || z + d / 2 > bounds.maxZ - margin + 0.000001) { return false; }
      for (const opening of context.openings ?? []) {
        if (opening.roomId !== room.id || opening.floorY !== room.floorY) { continue; }
        const normal = opening.axis === "x" ? Math.abs(x - opening.coordinate) - w / 2 : Math.abs(z - opening.coordinate) - d / 2;
        const along = opening.axis === "x" ? Math.abs(z - opening.center) - d / 2 : Math.abs(x - opening.center) - w / 2;
        if (normal < (opening.kind === "door" ? 0.75 : inset + 0.05) && along < opening.width / 2 + 0.25) { return false; }
      }
      for (const stair of context.stairs ?? []) {
        if (room.level >= stair.from && room.level <= stair.to && x + w / 2 > stair.minX && x - w / 2 < stair.maxX &&
          z + d / 2 > stair.minZ && z - d / 2 < stair.maxZ) { return false; }
      }
      return true;
    };
    /**
     * Measured GLB envelopes; yaw is baked into the validation footprint.
     * @param {string} object
     * @param {number} x
     * @param {number} z
     * @param {number} w
     * @param {number} d
     * @param {number} [y]
     * @param {number} [rotation]
     * @returns {boolean}
     */
    const prop = (object, x, z, w, d, y = 0, rotation = 0) => {
      const wallMounted = ["HangingFryingPan", "KitchenFireplace"].includes(object);
      const fireplace = object === "KitchenFireplace";
      if (!available(x, z, w, d, fireplace ? -0.22 : wallMounted ? 0 : inset,
        wallMounted ? room.wallBounds ?? room : room)) { return false; }
      items.push({ role: "kitchenProp", object, x, z, width: w, depth: d, scale: 1, y, rotation,
        ...(wallMounted ? { wallAttachment: true } : {}),
        ...(fireplace ? { wallInset: 0.22 } : {}) });
      return true;
    };
    // Side entrances face the opposite hearth wall. The preparation bank
    // occupies the end away from the entry, leaving the firebox accessible.
    if (width < 2 || depth < 2.5) { return items; }
    const sideEntry = (context.openings ?? []).find(/**
     * @param {import("../CastleBasePlanGenerator.js").CompiledCastleOpening} opening
     * @returns {boolean}
     */ opening => opening.roomId === room.id &&
      opening.floorY === room.floorY && opening.kind === "door" && ["WEST", "EAST"].includes(opening.side));
    const westEntry = sideEntry?.side === "WEST";
    const eastEntry = sideEntry?.side === "EAST";
    // The rear body is narrower than the hearth's base. Embed the base by
    // 22 cm so the stone body and chimney join the wall rather than float ahead.
    const hearthX = sideEntry ? westEntry ? (room.wallBounds ?? room).maxX + 0.22 - 0.4075
      : (room.wallBounds ?? room).minX + inset + 0.7035 : room.minX + inset + 0.704;
    // The compact kitchen's east entry uses the north exterior wall, beside
    // the gable corner, so the chimney follows the long side of the keep.
    const hearthZ = westEntry ? Math.max(room.minZ + inset + 0.7035,
      Math.min(sideEntry.center, room.maxZ - inset - 0.7035)) : eastEntry
      ? (room.wallBounds ?? room).minZ - 0.22 + 0.4075 : room.minZ + inset - 0.025 + 0.4075;
    const hearthRotation = westEntry ? -90 : 0;
    if (prop("KitchenFireplace", hearthX, hearthZ, westEntry ? 0.815 : 1.407, westEntry ? 1.407 : 0.815, 0, hearthRotation)) {
      prop("FireplaceCauldron", westEntry ? hearthX - 0.64 : hearthX,
        westEntry ? hearthZ : hearthZ + 0.64, westEntry ? 0.33 : 0.352, westEntry ? 0.352 : 0.33, 0, hearthRotation);
    }
    if (width < 2.8 || depth < 3) { return items; }
    const tableX = sideEntry ? room.minX + (eastEntry ? 2.3 : 2.2) + random() * (eastEntry ? 0.05 : 0.18) : room.maxX - inset - 0.314;
    const tableZ = sideEntry ? eastEntry ? room.maxZ - inset - 0.314 : room.minZ + inset + 0.314 : room.minZ + 1.5 + random() * 0.18;
    if (prop("KitchenTable", tableX, tableZ, sideEntry ? 1.25 : 0.628, sideEntry ? 0.628 : 1.25, 0, sideEntry ? 90 : 0)) {
      // Authored table's top is 0.564499 metres above its bottom-centre pivot.
      const top = 0.564499;
      const reverse = random() < 0.5 ? -1 : 1;
      prop("BowlGreenVegetables", sideEntry ? tableX - reverse * 0.38 : tableX, sideEntry ? tableZ : tableZ - reverse * 0.38, 0.291, 0.3, top, random() < 0.5 ? 0 : 180);
      prop("PlateBread", tableX, tableZ, 0.287, 0.3, top, random() < 0.5 ? 0 : 180);
      prop("BowlRedFruit", sideEntry ? tableX + reverse * 0.38 : tableX, sideEntry ? tableZ : tableZ + reverse * 0.38, 0.278, 0.3, top, random() < 0.5 ? 0 : 180);
      // Centre the utensils above the preparation table, with the mounting plates against its wall.
      const walls = room.wallBounds ?? room;
      prop("HangingFryingPan", sideEntry ? tableX : walls.maxX - 0.0955,
        sideEntry ? eastEntry ? walls.maxZ - 0.0955 : walls.minZ + 0.0955 : tableZ,
        sideEntry ? 1.2 : 0.191, sideEntry ? 0.191 : 1.2, 1.05, sideEntry ? eastEntry ? 180 : 0 : -90);
    }
    if (width >= 3.5 && depth >= 3.4) {
      const shelfX = room.minX + (westEntry ? 0.7 : 2.2);
      const shelfZ = room.minZ + inset + 0.15;
      if (available(shelfX, shelfZ, 0.8, 0.3)) {
        items.push({ role: "storageShelf", x: shelfX, z: shelfZ, width: 0.8, depth: 0.3, scale: 1 });
        prop("StoragePotteryJar", shelfX - 0.2, shelfZ, 0.229, 0.236, 0.9625);
        prop("TableCandles", shelfX + 0.2, shelfZ, 0.141, 0.192, 0.9625);
      }
      if (random() < 0.85) {
        prop(random() < 0.5 ? "WoodenCrate" : "WoodenBarrel", westEntry ? room.minX + 2.2 : room.maxX - 0.43,
          room.maxZ - 0.43, 0.554, 0.554);
      }
      if (depth >= 4.2 && random() < 0.65) {
        prop("WoodenCrate", room.maxX - 1.1, room.maxZ - 0.43, 0.55, 0.55);
      }
    }
    return items;
  }
}
