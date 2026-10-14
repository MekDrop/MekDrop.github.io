import { AbstractCastleRoomGenerator } from "./AbstractCastleRoomGenerator.js";

export class TowerRoomGenerator extends AbstractCastleRoomGenerator {
  /**
   * @param {number} index
   */
  constructor(index) { super(`tower${index}`, { x: 1.75, y: 1.75 }, { x: 2.25, y: 2.25 }); }
  /**
   * @returns {number[]}
   */
  get levels() { return [0]; }
  /**
   * @returns {number} Towers reserve both storeys, leaving basement rooms free.
   */
  get floorSpan() { return 2; }

  /**
   * Keep the watch floor open; supplies live in a small perimeter cluster.
   * Authored plans call this once per occupied storey, never for the crown.
   * @param {import("./AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @param {{seed?:string|number,wallThickness?:number,openings?:Array,stairs?:Array}} [context]
   * @returns {import("./AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  furnish(room, context = {}) {
    const items = [];
    let hash = 2166136261;
    for (const character of `${context.seed ?? room.furnishingSeed ?? room.seed ?? 0}:tower:${room.id}:${room.level}`) {
      hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
    }
    /**
     * @returns {number}
     */
    const random = () => {
      hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0;
      return hash / 4294967296;
    };
    const inset = (context.wallThickness ?? room.wallThickness ?? 0.25) / 2 + 0.08;
    const bounds = room.contentBounds ?? room;
    const minX = bounds.minX + inset;
    const maxX = bounds.maxX - inset;
    const minZ = bounds.minZ + inset;
    const maxZ = bounds.maxZ - inset;
    const width = maxX - minX;
    const depth = maxZ - minZ;
    if (Math.min(width, depth) < 1.25) { return items; }
    const area = width * depth;
    const limit = Math.min(5, Math.max(1, Math.floor(area / 1.5)));
    const corners = [[minX, minZ, 1, 1], [maxX, minZ, -1, 1],
      [maxX, maxZ, -1, -1], [minX, maxZ, 1, -1]];
    const start = Math.floor(random() * corners.length);
    const reverse = random() < 0.5 ? 1 : -1;
    const supplies = random() < 0.5 ? ["WoodenCrate", "WoodenBarrel"] : ["WoodenBarrel", "WoodenCrate"];
    const choices = [supplies[0], "SingleCandleStand", "WoodenDeskChair"];
    if (random() < 0.8) { choices.push(supplies[1]); }
    if (random() < 0.5) { choices.push(supplies[0]); }
    const sizes = { WoodenCrate: [0.56, 0.56], WoodenBarrel: [0.56, 0.56],
      WoodenDeskChair: [0.52, 0.52], SingleCandleStand: [0.18, 0.18] };
    for (const object of choices.slice(0, limit)) {
      const [itemWidth, itemDepth] = sizes[object];
      for (let attempt = 0; attempt < 12; attempt++) {
        const corner = corners[(start + reverse * attempt + 16) % 4];
        const [edgeX, edgeZ, signX, signZ] = corner;
        const jitter = random() * 0.12;
        const x = edgeX + signX * (itemWidth / 2 + jitter + Math.floor(attempt / 4) * 0.8);
        const z = edgeZ + signZ * (itemDepth / 2 + jitter);
        const halfX = itemWidth / 2;
        const halfZ = itemDepth / 2;
        if (x - halfX < minX || x + halfX > maxX || z - halfZ < minZ || z + halfZ > maxZ) { continue; }
        // A continuous cross through the centre provides window and stair access.
        const centerX = (minX + maxX) / 2;
        const centerZ = (minZ + maxZ) / 2;
        if (Math.abs(x - centerX) < halfX + 0.45 || Math.abs(z - centerZ) < halfZ + 0.45) { continue; }
        if (items.some(/**
         *
         * @param {import("./AbstractCastleRoomGenerator.js").RoomItem} item
         */
        (item) => Math.abs(item.x - x) < (item.width + itemWidth) / 2 + 0.22 &&
          Math.abs(item.z - z) < (item.depth + itemDepth) / 2 + 0.22)) { continue; }
        if ((context.openings ?? room.openings ?? []).some(/**
         *
         * @param {import("../CastleBasePlanGenerator.js").CompiledCastleOpening} opening
         */
        (opening) => opening.roomId === room.id &&
          opening.floorY === room.floorY && (opening.axis === "x"
            ? Math.abs(x - opening.coordinate) < halfX + 0.85 && Math.abs(z - opening.center) < halfZ + opening.width / 2 + 0.3
            : Math.abs(z - opening.coordinate) < halfZ + 0.85 && Math.abs(x - opening.center) < halfX + opening.width / 2 + 0.3))) { continue; }
        if ((context.stairs ?? room.stairs ?? []).some(/**
         *
         * @param {{from:number,to:number,minX:number,maxX:number,minZ:number,maxZ:number}} stair
         */
        (stair) => room.level >= stair.from && room.level <= stair.to &&
          x + halfX > stair.minX - 0.35 && x - halfX < stair.maxX + 0.35 &&
          z + halfZ > stair.minZ - 0.35 && z - halfZ < stair.maxZ + 0.35)) { continue; }
        items.push({ role: "towerProp", object, x, z, width: itemWidth, depth: itemDepth,
          height: { WoodenCrate: 0.471, WoodenBarrel: 0.65, WoodenDeskChair: 0.85, SingleCandleStand: 0.8 }[object],
          id: `${room.id}-tower-${items.length}`, scale: 1,
          // This authored chair faces -X; its high back occupies +X in the GLB.
          rotation: object === "WoodenDeskChair" ? (signZ > 0 ? 90 : 270) : Math.floor(random() * 4) * 90 });
        break;
      }
    }
    return items;
  }
}
