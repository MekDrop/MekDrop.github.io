import { AbstractCastleRoomGenerator } from "../AbstractCastleRoomGenerator.js";
import { VestibuleIslandFurnishing } from "./VestibuleIslandFurnishing.js";
import { VestibuleWallFurnishing } from "./VestibuleWallFurnishing.js";
import { VestibuleWindowFurnishing } from "./VestibuleWindowFurnishing.js";

/**
 * Arrival storage surrounds either central seating or a map table where space permits.
 */
export class VestibuleRoomGenerator extends AbstractCastleRoomGenerator {
  constructor() { super("vestibule", { x: 2, y: 2 }); }

  /**
   * @param {import("../AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @param {{wallThickness?:number,openings?:import("../../CastleBasePlanGenerator.js").CompiledCastleOpening[],stairs?:Array}} [context]
   * @returns {import("../AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  furnish(room, context = {}) {
    const items = [];
    const inset = (context.wallThickness ?? 0.25) / 2;
    const wall = room.minX;
    const low = room.minZ + inset + 0.12;
    const high = room.maxZ - inset - 0.12;
    if (room.maxX - room.minX < 2 || high - low < 1.5) { return items; }
    /**
     * @param {import("../AbstractCastleRoomGenerator.js").RoomItem} item
     * @returns {boolean}
     */
    const safe = item => {
      const halfX = item.width * item.scale / 2;
      const halfZ = item.depth * item.scale / 2;
      if (item.x - halfX < room.minX || item.x + halfX > room.maxX ||
        item.z - halfZ < room.minZ || item.z + halfZ > room.maxZ) { return false; }
      if ((context.openings ?? []).some(/**
       * @param {import("../../CastleBasePlanGenerator.js").CompiledCastleOpening} opening
       */ opening => opening.floorY === room.floorY && (item.y ?? 0) + item.height * item.scale > 0.05 &&
        !(opening.kind === "window" && (item.y ?? 0) + item.height * item.scale <= opening.bottom - 0.1) &&
        (opening.axis === "x" ? Math.abs(item.x - opening.coordinate) < halfX + 0.85 &&
          Math.abs(item.z - opening.center) < halfZ + opening.width / 2 + 0.25 :
          Math.abs(item.z - opening.coordinate) < halfZ + 0.85 &&
          Math.abs(item.x - opening.center) < halfX + opening.width / 2 + 0.25))) { return false; }
      return !(context.stairs ?? []).some(/**
       * @param {{from:number,to:number,minX:number,maxX:number,minZ:number,maxZ:number}} stair
       */ stair => room.level >= stair.from && room.level <= stair.to &&
        item.x + halfX > stair.minX - 0.35 && item.x - halfX < stair.maxX + 0.35 &&
        item.z + halfZ > stair.minZ - 0.35 && item.z - halfZ < stair.maxZ + 0.35);
    };
    // Try both ends of the wall; windows retain a clear approach.
    for (let z = low + 0.65; z <= high - 0.65; z += 0.1) {
      const bench = { role: "vestibuleProp", object: "VestibuleBench", x: wall + 0.27,
        z, width: 0.5, depth: 1.3, height: 0.82, scale: 1, rotation: 90, y: 0.002 };
      if (!safe(bench)) { continue; }
      items.push(bench);
      for (const offset of [-0.35, 0.35]) {
        const rail = { role: "vestibuleProp", object: "VestibuleCloakRail", x: wall + 0.09,
          z: z + offset, width: 0.1771, depth: 1.1, height: 1.365, scale: 0.78,
          rotation: 90, y: 1.28 };
        if (safe(rail)) { items.push(rail); }
      }
      // Tuck the shafts behind the front brace; the low toes fit beneath it.
      const boots = { role: "vestibuleProp", object: "Boots", x: wall + 0.3,
        z: z + 0.05, width: 0.5, depth: 0.7, height: 0.28, scale: 1, rotation: 90, y: 0.002 };
      if (safe(boots)) { items.push(boots); }
      const stand = { role: "vestibuleProp", object: "VestibuleStickStand", x: wall + 0.25,
        z: z + 1, width: 0.36, depth: 0.36, height: 1.05, scale: 1, rotation: 90, y: 0.002 };
      if (safe(stand)) { items.push(stand); }
      break;
    }
    // Low benches use the empty window bays without covering their glass.
    for (const window of (context.openings ?? []).filter(/**
     * @param {import("../../CastleBasePlanGenerator.js").CompiledCastleOpening} opening
     */ opening => opening.roomId === room.id && opening.kind === "window" &&
      opening.axis === "x" && opening.floorY === room.floorY && opening.coordinate === wall)) {
      const z = Math.max(low + 0.52, Math.min(high - 0.52, window.center));
      const bench = { role: "vestibuleProp", object: "VestibuleBench", x: wall + 0.32,
        z, width: 0.4, depth: 1.04, height: 0.82, scale: 1,
        stretch: { x: 0.8, y: 1, z: 0.8 }, rotation: 90, y: 0.002 };
      const free = safe(bench) && !items.some(/**
       * @param {import("../AbstractCastleRoomGenerator.js").RoomItem} item
       */ item => (item.y ?? 0) < 0.9 && Math.abs(item.x - bench.x) <
        (item.width * item.scale + bench.width * bench.scale) / 2 + 0.05 &&
        Math.abs(item.z - bench.z) < (item.depth * item.scale + bench.depth * bench.scale) / 2 + 0.12);
      if (!free) { continue; }
      items.push(bench);
      const planter = { role: "vestibuleProp", object: "TerracePlanter", x: wall + 0.35,
        z: z - 0.85, width: 0.665, depth: 0.665, height: 0.99, scale: 0.65,
        rotation: 90, y: 0.002 };
      if (safe(planter) && !items.some(/**
       * @param {import("../AbstractCastleRoomGenerator.js").RoomItem} item
       */ item => (item.y ?? 0) < 0.9 && Math.abs(item.x - planter.x) <
        (item.width * item.scale + planter.width * planter.scale) / 2 + 0.05 &&
        Math.abs(item.z - planter.z) < (item.depth * item.scale + planter.depth * planter.scale) / 2 + 0.05)) {
        items.push(planter);
      }
    }
    const arrivalCornerCount = items.length;
    // The opposite wall's door-free pocket holds luggage and the framed picture.
    if (room.id === "vestibule") {
      const oppositeWall = room.maxX;
      const centerZ = (low + high) / 2;
      for (let offset = 0; offset <= (high - low) / 2; offset += 0.1) {
        const chest = { id: `${room.id}-${room.level}-luggage-chest`, role: "vestibuleProp", object: "WoodenStorageChest",
          x: oppositeWall - 0.405, z: centerZ + offset, width: 0.55, depth: 0.7,
          height: 0.3291 * 0.82, scale: 1.4, stretch: { x: 1, y: 0.82, z: 1 },
          wallMountBack: -0.275, rotation: 270, y: 0.002 };
        const painting = { role: "vestibuleProp", object: "VestibulePainting",
          x: oppositeWall - 0.3, z: chest.z, width: 0.08, depth: 1.05,
          height: 0.78, scale: 1, rotation: 270, y: 1.15 };
        if (!safe(chest) || !safe(painting)) { continue; }
        items.push(chest, painting);
        items.push({ role: "vestibuleProp", object: "TravelKit",
          x: chest.x, z: chest.z, width: 0.3, depth: 0.48, height: 0.45,
          scale: 1, rotation: 270, y: chest.height * chest.scale + 0.002, supportId: chest.id });
        // A single armor display flanks the picture while respecting door swings.
        for (const side of [1, -1]) {
          const armor = { role: "vestibuleProp", object: "StandingArmor",
            x: oppositeWall - 0.34, z: chest.z + side * 1.2,
            width: 0.4, depth: 0.65, height: 1.75, scale: 1, rotation: 270, y: 0.002 };
          if (!safe(armor) || items.some(/**
           * @param {import("../AbstractCastleRoomGenerator.js").RoomItem} item
           */ item => Math.abs(item.x - armor.x) < (item.width * item.scale + armor.width) / 2 + 0.05 &&
            Math.abs(item.z - armor.z) < (item.depth * item.scale + armor.depth) / 2 + 0.08)) { continue; }
          items.push(armor);
          break;
        }
        break;
      }
    }
    // Mount a lantern on an unused stretch of the same wall.
    for (let z = high - 0.3; z >= low + 0.3; z -= 0.15) {
      const lantern = { role: "vestibuleProp", object: "VestibuleLantern", x: wall + 0.13,
        z, width: 0.257, depth: 0.187, height: 0.45, scale: 1, rotation: 90, y: 1.75 };
      if (!safe(lantern) || items.some(/**
       * @param {import("../AbstractCastleRoomGenerator.js").RoomItem} item
       */ item => (item.y ?? 0) + item.height * item.scale > lantern.y - 0.1 &&
          Math.abs(item.x - lantern.x) < 0.7 &&
          Math.abs(item.z - z) < item.depth * item.scale / 2 + 0.3)) { continue; }
      items.push(lantern);
      break;
    }
    if (room.id === "vestibule") {
      const banner = { role: "vestibuleProp", object: "VestibuleBanner", x: (room.minX + room.maxX) / 2,
        z: room.minZ + 0.02, width: 1.1, depth: 0.03, height: 1.3,
        scale: 1, stretch: { x: 1.1, y: 1.3, z: 1 }, rotation: 0, y: 2.35 };
      if (safe(banner)) { items.push(banner); }
    }
    const wallFurniture = VestibuleWallFurnishing.furnish(room, items, safe, context.wallThickness ?? 0.25);
    const islands = VestibuleIslandFurnishing.furnish(room, [...items.slice(arrivalCornerCount), ...wallFurniture],
      safe, context.wallThickness ?? 0.25);
    // A central arrival layout replaces the old perimeter seating corner.
    if (islands.length) { items.splice(0, arrivalCornerCount); }
    items.push(...wallFurniture, ...islands);
    // Larger rooms use a broad rug to anchor the freestanding furniture group.
    if (islands.length) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      const margin = islands[0].object === "VestibuleIslandBench" && islands[0].width * islands[0].depth > 3 ? 0.65 : 0.3;
      for (const island of islands) {
        minX = Math.min(minX, island.x - island.width * island.scale / 2 - margin);
        maxX = Math.max(maxX, island.x + island.width * island.scale / 2 + margin);
        minZ = Math.min(minZ, island.z - island.depth * island.scale / 2 - margin);
        maxZ = Math.max(maxZ, island.z + island.depth * island.scale / 2 + margin);
      }
      items.push({ role: "vestibuleProp", object: "VestibuleRug", x: (minX + maxX) / 2,
        z: (minZ + maxZ) / 2, width: maxX - minX, depth: maxZ - minZ, height: 0.0306,
        scale: 1, stretch: { x: (maxX - minX) / 1.3, y: 1, z: (maxZ - minZ) / 3.3 },
        rotation: 0, y: 0.002, floorCovering: true });
      items.push(...VestibuleWindowFurnishing.furnish(room, items, context.openings ?? [], safe, context.wallThickness ?? 0.25));
      return items;
    }
    // A thin rug marks the route in narrow vestibules.
    const runnerLength = room.maxZ - room.minZ - 0.12;
    const rug = { role: "vestibuleProp", object: "VestibuleRug", x: (room.minX + room.maxX) / 2,
      z: (room.minZ + room.maxZ) / 2, width: 1.3, depth: runnerLength, height: 0.031,
      scale: 1, stretch: { x: 1, y: 1, z: runnerLength / 3.3 }, rotation: 0, y: 0.002 };
    if (safe(rug)) { items.push(rug); }
    return items;
  }
}
