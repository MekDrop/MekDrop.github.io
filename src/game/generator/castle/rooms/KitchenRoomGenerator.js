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
     * @returns {boolean}
     */
    const available = (x, z, w, d, margin = inset) => {
      if (x - w / 2 < room.minX + margin - 0.000001 || x + w / 2 > room.maxX - margin + 0.000001 ||
        z - d / 2 < room.minZ + margin - 0.000001 || z + d / 2 > room.maxZ - margin + 0.000001) { return false; }
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
      if (!available(x, z, w, d, wallMounted ? inset - 0.025 : inset)) { return false; }
      items.push({ role: "kitchenProp", object, x, z, width: w, depth: d, scale: 1, y, rotation });
      return true;
    };
    // A north cooking bank and east prep bank leave the southern service aisle
    // and west inward door swing open. Optional storage yields to smaller rooms.
    if (width < 2 || depth < 2.5) { return items; }
    const hearthX = room.minX + inset + 0.704;
    const hearthZ = room.minZ + inset - 0.025 + 0.4075;
    if (prop("KitchenFireplace", hearthX, hearthZ, 1.407, 0.815)) {
      prop("FireplaceCauldron", hearthX, hearthZ + 0.64, 0.352, 0.33);
    }
    if (width < 2.8 || depth < 3) { return items; }
    const tableX = room.maxX - inset - 0.314;
    const tableZ = room.minZ + 1.5 + random() * 0.18;
    if (prop("KitchenTable", tableX, tableZ, 0.628, 1.25)) {
      // Authored table's top is 0.564499 metres above its bottom-centre pivot.
      const top = 0.564499;
      const reverse = random() < 0.5 ? -1 : 1;
      prop("BowlGreenVegetables", tableX, tableZ - reverse * 0.38, 0.291, 0.3, top, random() < 0.5 ? 0 : 180);
      prop("PlateBread", tableX, tableZ, 0.287, 0.3, top, random() < 0.5 ? 0 : 180);
      prop("BowlRedFruit", tableX, tableZ + reverse * 0.38, 0.278, 0.3, top, random() < 0.5 ? 0 : 180);
    }
    prop("HangingFryingPan", room.minX + inset - 0.025 + 0.031, room.minZ + 1.65, 0.062, 0.2, 1.05, 90);
    if (width >= 3.5 && depth >= 3.4) {
      const shelfX = room.minX + 2.2;
      const shelfZ = room.minZ + inset + 0.15;
      if (available(shelfX, shelfZ, 0.8, 0.3)) {
        items.push({ role: "storageShelf", x: shelfX, z: shelfZ, width: 0.8, depth: 0.3, scale: 1 });
        prop("StoragePotteryJar", shelfX - 0.2, shelfZ, 0.229, 0.236, 0.9625);
        prop("TableCandles", shelfX + 0.2, shelfZ, 0.141, 0.192, 0.9625);
      }
      if (random() < 0.85) {
        prop(random() < 0.5 ? "WoodenCrate" : "WoodenBarrel", room.maxX - 0.43,
          room.maxZ - 0.43, 0.554, 0.554);
      }
      if (depth >= 4.2 && random() < 0.65) {
        prop("WoodenCrate", room.maxX - 1.1, room.maxZ - 0.43, 0.55, 0.55);
      }
    }
    return items;
  }
}
