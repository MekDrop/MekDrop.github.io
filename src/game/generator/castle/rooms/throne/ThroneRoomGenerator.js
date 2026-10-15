import { Vec2 } from "playcanvas";
import { AbstractCastleRoomGenerator } from "../AbstractCastleRoomGenerator.js";

export class ThroneRoomGenerator extends AbstractCastleRoomGenerator {
  constructor() {
    super("throneRoom", new Vec2(3, 3), new Vec2(3, 3.25));
  }
  /**
   * @returns {number[]}
   */
  get levels() { return [0]; }
  /**
   * The audience object keeps its throne, runner and rear lanterns.
   * Court furniture stays outside its central visitor and royal movement lane.
   * Dimensions are the exported prop envelopes, including candle arms.
   * @param {import("../AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @param {{seed?:string|number,openings?:import("../../CastleBasePlanGenerator.js").CompiledCastleOpening[],stairs?:Array<{minX:number,maxX:number,minZ:number,maxZ:number,from:number,to:number}>}} [context]
   * @returns {import("../AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  furnish(room, context = {}) {
    const bounds = room.contentBounds ?? room;
    const width = bounds.maxX - bounds.minX;
    const depth = bounds.maxZ - bounds.minZ;
    if (width < 3.3 || depth < 3.1) { return []; }
    let state = 2166136261;
    const sourceSeed = context.seed ?? room.furnishingSeed ?? room.seed ?? 0;
    const numeric = Number(sourceSeed);
    const seed = Number.isFinite(numeric) ? Math.floor(Math.abs(numeric) / 2) : sourceSeed;
    for (const character of `${seed}:${room.id}:court`) {
      state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
    }
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const variant = ["royalCourt", "scholarKing", "warCouncil"][Math.floor(random() * 3)];
    const center = (bounds.minX + bounds.maxX) / 2;
    const items = [];
    /**
     * Reject an entire support group before the compiler can orphan its details.
     * @param {number} x
     * @param {number} z
     * @param {number} itemWidth
     * @param {number} itemDepth
     * @returns {boolean}
     */
    const fits = (x, z, itemWidth, itemDepth) => {
      const halfX = itemWidth / 2;
      const halfZ = itemDepth / 2;
      if (x - halfX < bounds.minX + 0.125 || x + halfX > bounds.maxX - 0.125 ||
        z - halfZ < bounds.minZ + 0.125 || z + halfZ > bounds.maxZ - 0.125) { return false; }
      for (const door of context.openings ?? []) {
        if (door.roomId !== room.id || door.kind !== "door") { continue; }
        if (door.axis === "x" ? Math.abs(x - door.coordinate) < halfX + 0.75 &&
          Math.abs(z - door.center) < halfZ + door.width / 2 + 0.25 :
          Math.abs(z - door.coordinate) < halfZ + 0.75 &&
          Math.abs(x - door.center) < halfX + door.width / 2 + 0.25) { return false; }
      }
      for (const stair of context.stairs ?? []) {
        if (room.level < stair.from || room.level > stair.to) { continue; }
        if (x + halfX > stair.minX && x - halfX < stair.maxX &&
          z + halfZ > stair.minZ && z - halfZ < stair.maxZ) { return false; }
      }
      return true;
    };
    /**
     * @param {string} object
     * @param {number} x
     * @param {number} z
     * @param {number} itemWidth
     * @param {number} itemDepth
     * @param {number} [elevation]
     * @param {number} [rotation]
     */
    const add = (object, x, z, itemWidth, itemDepth, elevation = 0.05, rotation = 0) => {
      const angle = rotation * Math.PI / 180;
      items.push({
        role: "courtProp",
        object,
        x,
        z,
        width: Math.abs(Math.cos(angle)) * itemWidth + Math.abs(Math.sin(angle)) * itemDepth,
        depth: Math.abs(Math.sin(angle)) * itemWidth + Math.abs(Math.cos(angle)) * itemDepth,
        scale: 1,
        elevation,
        rotation,
        mirrorRotationOffset: object === "Chair" ? 180 : 0,
      });
    };
    // Top-mounted authored cloth hangs clear of the rear wall and candle groups.
    const bannerLateral = Math.min(1.68, width / 2 - 0.6);
    for (const side of [-1, 1]) {
      add("Banner", center + side * bannerLateral, bounds.minZ + 0.38,
        0.98, 0.1, 2.35);
      items.at(-1).stretch = {
        x: 0.975,
        y: 1.4,
        z: 1,
      };
      items.at(-1).height = 1.38;
    }
    const rearWindow = (context.openings ?? room.openings ?? []).some(/**
     * @param {import("../../CastleBasePlanGenerator.js").CompiledCastleOpening} opening
     */
      opening => opening.kind === "window" && opening.roomId === room.id &&
      opening.axis === "z" && Math.abs(opening.coordinate - bounds.minZ) < 0.3 &&
      Math.abs(opening.center - center) < opening.width / 2 + 0.4);
    add("ThroneDais", center, bounds.minZ + (rearWindow ? 0.55 : 0.65), 1.1, 0.95, 0.05);
    items.at(-1).height = 0.1;
    // Keep the emblem above the throne and the rear wall's window lintel.
    add(variant === "warCouncil" ? "WarCouncilShield" : "RoyalCrest", center,
      bounds.minZ + 0.2, variant === "warCouncil" ? 0.7 : 1, 0.1, 2.15);
    if (variant !== "warCouncil") { items.at(-1).scale = 0.7; }
    const candleForward = bounds.minZ + 0.55 + random() * 0.14;
    for (const side of [-1, 1]) {
      const x = center + side * (width / 2 - 0.45);
      if (fits(x, candleForward, 0.308, 0.325)) {
        add("FloorCandelabrum", x, candleForward, 0.308, 0.325);
      }
    }
    // Each work group occupies the front corner opposite the audience doorway.
    if (width >= 3.8 && depth >= 3.65) {
      const doors = (context.openings ?? room.openings ?? []).filter(/**
       *
       * @param {import("../../CastleBasePlanGenerator.js").CompiledCastleOpening} opening
       */
        (opening) =>
          opening.kind === "door" && (!opening.roomId || opening.roomId === room.id));
      const side = doors.some(/**
       *
       * @param {import("../../CastleBasePlanGenerator.js").CompiledCastleOpening} door
       */
        (door) => door.side === "EAST") ? -1 : 1;
      const x = center + side * (width / 2 - 0.52);
      const z = bounds.maxZ - 0.95 - random() * 0.12;
      if (!fits(x, z, 0.628, 1.25)) { return items; }
      if (variant === "royalCourt") {
        add("Lectern", x, z, 0.45, 0.45, 0.05, side > 0 ? 90 : -90);
        items.at(-1).type = "court";
      } else if (variant === "scholarKing") {
        add("WritingDesk", x, z, 0.9, 0.55, 0.05, 90);
        add("OpenReadingBook", x, z + 0.1, 0.36, 0.227, 0.7, 90);
        if (random() > 0.3) { add("DeskGlobe", x, z - 0.305, 0.24, 0.285, 0.7); }
        const shelfX = center - side * (width / 2 - 0.35);
        const shelfZ = bounds.minZ + 1.55;
        if (fits(shelfX, shelfZ, 0.36, 0.85)) {
          add("Bookshelf", shelfX, shelfZ, 0.85, 0.36, 0.05, side > 0 ? -90 : 90);
          items.at(-1).height = 1.35;
        }
      } else {
        add("WarMapTable", x, z, 0.628, 1.25);
        const rackX = center - side * (width / 2 - 0.45);
        const rackZ = bounds.minZ + 1.55;
        if (fits(rackX, rackZ, 0.5, 0.25)) { add("SpearRack", rackX, rackZ, 0.5, 0.25); }
      }
      // Larger rooms put a clerk at the work surface; compact rooms seat visitors
      // against the front wall, outside both the inward door swing and the runner.
      // The measured chair back lies on +X, so its authored front faces -X.
      if (width >= 4.5) {
        if (fits(x - side * 0.76, z + 0.15, 0.429, 0.508)) {
          add("Chair", x - side * 0.76, z + 0.15, 0.429, 0.508, 0.05, side > 0 ? 180 : 0);
        }
      } else {
        const chairX = center - side * (width / 2 - 0.82);
        const chairZ = bounds.maxZ - 0.43;
        if (fits(chairX, chairZ, 0.508, 0.429)) {
          add("Chair", chairX, chairZ, 0.429, 0.508, 0.05, -90);
        }
      }
    }
    return items;
  }
}
