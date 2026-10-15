import { AbstractCastleRoomGenerator } from "../AbstractCastleRoomGenerator.js";
import { FireplaceWallBacking } from "../FireplaceWallBacking.js";

export class KitchenRoomGenerator extends AbstractCastleRoomGenerator {
  constructor() { super("kitchen", { x: 2, y: 2.5 }); }
  /**
   * @returns {number[]}
   */
  get levels() { return [-1, 0]; }
  /**
   * Keep the service-door aisle clear in the compact kitchen.
   * @param {import("../AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @param {{seed?:string|number,openings?:Array,stairs?:Array,wallThickness?:number}} [context]
   * @returns {import("../AbstractCastleRoomGenerator.js").RoomItem[]}
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
     * @param {import("../AbstractCastleRoomGenerator.js").PlannedCastleRoom} [bounds]
     * @returns {boolean}
     */
    const available = (x, z, w, d, margin = inset, bounds = room) => {
      if (x - w / 2 < bounds.minX + margin - 0.000001 || x + w / 2 > bounds.maxX - margin + 0.000001 ||
        z - d / 2 < bounds.minZ + margin - 0.000001 || z + d / 2 > bounds.maxZ - margin + 0.000001) { return false; }
      for (const opening of context.openings ?? []) {
        if (opening.floorY !== room.floorY) { continue; }
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
     * @param {import("../../../../objects/ObjectTypes.js").MapObjectDefinition[]} [contents]
     * @param {string} [color]
     * @returns {boolean}
     */
    const prop = (object, x, z, w, d, y = 0, rotation = 0, contents = undefined, color = undefined) => {
      const wallMounted = ["HangingFryingPan", "Fireplace"].includes(object);
      const fireplace = object === "Fireplace";
      if (fireplace && !FireplaceWallBacking.accepts({ object, x, z, width: w, depth: d, scale: 1, y },
        room, context.openings ?? [])) { return false; }
      if (!available(x, z, w, d, wallMounted ? 0 : ["FirewoodStack", "KitchenTable"].includes(object) ? 0.015 : inset,
        wallMounted ? room.wallBounds ?? room : room)) { return false; }
      if (y === 0 && !wallMounted && items.some(/**
       * @param {import("../AbstractCastleRoomGenerator.js").RoomItem} item
       */ item => (item.y ?? 0) === 0 &&
        Math.abs(item.x - x) < (item.width + w) / 2 + 0.04 &&
        Math.abs(item.z - z) < (item.depth + d) / 2 + 0.04)) { return false; }
      items.push({ role: "kitchenProp", object, x, z, width: w, depth: d, scale: 1, y, rotation,
        ...(contents ? { items: contents, color, height: 0.231 } : {}),
        ...(wallMounted ? { wallAttachment: true } : {}),
        ...(fireplace ? { wallInset: 0 } : {}) });
      return true;
    };
    // Side entrances face the opposite hearth wall. The preparation bank
    // occupies the end away from the entry, leaving the firebox accessible.
    if (width < 2 || depth < 2.5) { return items; }
    const sideEntry = (context.openings ?? []).find(/**
     * @param {import("../../CastleBasePlanGenerator.js").CompiledCastleOpening} opening
     * @returns {boolean}
     */ opening => opening.roomId === room.id &&
      opening.floorY === room.floorY && opening.kind === "door" && ["WEST", "EAST"].includes(opening.side));
    const westEntry = sideEntry?.side === "WEST";
    const eastEntry = sideEntry?.side === "EAST";
    // The side-tower hearth shares the preparation wall, beyond the door aisle.
    const walls = room.wallBounds ?? room;
    const rearOffset = 0.45;
    // Leave a narrow floor pocket against the side wall for firewood.
    let hearthX = westEntry ? room.maxX - inset - 0.735 - 0.25 : room.minX + inset + 0.735;
    let hearthZ = westEntry ? walls.maxZ - (context.wallThickness ?? 0.25) / 2 - rearOffset
      : walls.minZ + (context.wallThickness ?? 0.25) / 2 + rearOffset;
    const hearthRotation = westEntry ? 180 : 0;
    const hearthWidth = 1.47, hearthDepth = 0.88;
    let fireplacePlaced = prop("Fireplace", hearthX, hearthZ, hearthWidth, hearthDepth, 0, hearthRotation);
    for (const fraction of [0, 1, 0.5, 0.25, 0.75]) {
      if (fireplacePlaced) { break; }
      const walls = room.wallBounds ?? room;
      hearthX = walls.minX + inset + hearthWidth / 2 + fraction * (walls.maxX - walls.minX - 2 * inset - hearthWidth);
      fireplacePlaced = prop("Fireplace", hearthX, hearthZ, hearthWidth, hearthDepth, 0, hearthRotation);
    }
    if (fireplacePlaced) {
      if (westEntry) { prop("FirewoodStack", hearthX + hearthWidth / 2 + 0.2, hearthZ, 0.269, 0.38); }
      prop("FireplaceCauldron", hearthX, hearthZ + (westEntry ? -0.7 : 0.7), 0.352, 0.33, 0, hearthRotation);
    }
    if (width < 2.8 || depth < 3) { return items; }
    let tableX = sideEntry ? room.minX + (eastEntry ? 2.3 : 2.2) + random() * (eastEntry ? 0.05 : 0.18) : room.maxX - inset - 0.314;
    let tableZ = sideEntry ? eastEntry ? walls.maxZ - (context.wallThickness ?? 0.25) / 2 - 0.314 - 0.015 : walls.minZ + (context.wallThickness ?? 0.25) / 2 + 0.314 + 0.015 : room.minZ + 1.5 + random() * 0.18;
    let tablePlaced = prop("KitchenTable", tableX, tableZ, sideEntry ? 1.25 : 0.628, sideEntry ? 0.628 : 1.25, 0, sideEntry ? 90 : 0);
    for (const bank of sideEntry ? [0, 1] : [0]) {
      for (const fraction of [0.2, 0.5, 0.8]) {
        if (tablePlaced) { break; }
        if (sideEntry) {
          tableX = room.minX + inset + 0.625 + fraction * (width - 2 * inset - 1.25);
          if (bank === 1) { tableZ = eastEntry ? walls.minZ + (context.wallThickness ?? 0.25) / 2 + 0.314 + 0.015 : walls.maxZ - (context.wallThickness ?? 0.25) / 2 - 0.314 - 0.015; }
        }
        else { tableZ = room.minZ + inset + 0.625 + fraction * (depth - 2 * inset - 1.25); }
        tablePlaced = prop("KitchenTable", tableX, tableZ, sideEntry ? 1.25 : 0.628, sideEntry ? 0.628 : 1.25, 0, sideEntry ? 90 : 0);
      }
    }
    if (tablePlaced) {
      // Authored table's top is 0.564499 metres above its bottom-centre pivot.
      const top = 0.564499;
      const reverse = random() < 0.5 ? -1 : 1;
      prop("Bowl", sideEntry ? tableX - reverse * 0.38 : tableX, sideEntry ? tableZ : tableZ - reverse * 0.38, 0.291, 0.3, top, random() < 0.5 ? 0 : 180, Array.from({ length: 9 }, () => ({ object: "GreenVegetable" })), "#b16832");
      prop("Bowl", tableX, tableZ, 0.3, 0.3, top, random() < 0.5 ? 0 : 180, Array.from({ length: 3 }, () => ({ object: "Bread" })), "#ffffff");
      prop("Bowl", sideEntry ? tableX + reverse * 0.38 : tableX, sideEntry ? tableZ : tableZ + reverse * 0.38, 0.278, 0.3, top, random() < 0.5 ? 0 : 180, Array.from({ length: 5 }, () => ({ object: "Apple" })), "#ffffff");
      // Centre the utensils above the preparation table, with the mounting plates against its wall.
      const walls = room.wallBounds ?? room;
      prop("HangingFryingPan", sideEntry ? tableX : walls.maxX - 0.0955,
        sideEntry ? tableZ > (room.minZ + room.maxZ) / 2 ? walls.maxZ - 0.0955 : walls.minZ + 0.0955 : tableZ,
        sideEntry ? 1.2 : 0.191, sideEntry ? 0.191 : 1.2, 1.05, sideEntry ? tableZ > (room.minZ + room.maxZ) / 2 ? 180 : 0 : -90);
    }
    if (width >= 3.5 && depth >= 3.4) {
      const shelfCandidates = [{ x: room.minX + (westEntry ? 0.7 : 2.2), z: room.minZ + inset + 0.15, rotation: 0 },
        ...(westEntry ? [{ x: room.minX + inset + 0.15, z: room.maxZ - inset - 0.85, rotation: 90 }] : [])];
      for (const shelf of shelfCandidates) {
        const sideways = shelf.rotation === 90;
        const shelfWidth = sideways ? 0.3 : 0.8, shelfDepth = sideways ? 0.8 : 0.3;
        if (!available(shelf.x, shelf.z, shelfWidth, shelfDepth) || items.some(/**
         * @param {import("../AbstractCastleRoomGenerator.js").RoomItem} item
         */ item => (item.y ?? 0) === 0 && Math.abs(item.x - shelf.x) < (item.width + shelfWidth) / 2 + 0.04 &&
          Math.abs(item.z - shelf.z) < (item.depth + shelfDepth) / 2 + 0.04)) { continue; }
        const support = { id: room.id + "-kitchen-pantry-shelf", role: "storageShelf", ...shelf,
          width: shelfWidth, depth: shelfDepth, height: 0.9625, scale: 1 };
        items.push(support);
        if (prop("StoragePotteryJar", shelf.x - (sideways ? 0 : 0.2), shelf.z - (sideways ? 0.2 : 0), 0.229, 0.236, support.height)) {
          items.at(-1).supportId = support.id;
        }
        if (prop("TableCandles", shelf.x + (sideways ? 0 : 0.2), shelf.z + (sideways ? 0.2 : 0), 0.141, 0.192, support.height)) {
          items.at(-1).supportId = support.id;
        }
        break;
      }
      if (random() < 0.85) {
        prop(random() < 0.5 ? "WoodenCrate" : "Barrel", westEntry ? room.minX + 2.2 : room.maxX - 0.43,
          room.maxZ - 0.43, 0.554, 0.554);
      }
      if (depth >= 4.2 && random() < 0.65) {
        prop("WoodenCrate", room.maxX - 1.1, room.maxZ - 0.43, 0.55, 0.55);
      }
    }
    if (width >= 3.5 && depth >= 3.4) {
      let supplies = 0;
      for (const fraction of [0.2, 0.5, 0.8]) {
        for (const z of [room.maxZ - inset - 0.3, room.minZ + inset + 0.3]) {
          const x = room.minX + inset + 0.3 + fraction * (width - 2 * inset - 0.6);
          if (!(x - 0.277 < room.minX + 1.2 && z + 0.277 > room.maxZ - 1.35) && supplies < 3 && prop(supplies === 0 ? "Barrel" : "WoodenCrate", x, z, 0.554, 0.554)) {
            prop(supplies === 0 ? "StoragePotteryJar" : "FoldedLinens", x, z, 0.23, 0.236, supplies === 0 ? 0.65 : 0.4702);
            supplies++;
          }
        }
      }
    }
    return items;
  }
}
