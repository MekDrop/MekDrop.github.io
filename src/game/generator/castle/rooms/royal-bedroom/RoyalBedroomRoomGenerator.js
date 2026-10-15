import { Vec2 } from "playcanvas";
import { AbstractCastleRoomGenerator } from "../AbstractCastleRoomGenerator.js";
import { RoyalBedroomFurnishing } from "./RoyalBedroomFurnishing.js";

/**
 * Royal sleeping rooms keep their own layout stream and measured castle props.
 */
export class RoyalBedroomRoomGenerator extends AbstractCastleRoomGenerator {
  constructor() { super("royalBedroom", new Vec2(3, 3), new Vec2(8, 8)); }

  /**
   * @returns {number[]}
   */
  get levels() { return [-1, 1, 0]; }

  /**
   * @returns {string[]}
   */
  static get variations() {
    return RoyalBedroomFurnishing.variations;
  }

  /**
   * Include apertures authored by the neighbouring room on a shared wall.
   * @param {import("../AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @param {{seed?:string|number,wallThickness?:number,openings?:import("../../CastleBasePlanGenerator.js").CompiledCastleOpening[],stairs?:Array<{from:number,to:number,minX:number,maxX:number,minZ:number,maxZ:number}>}} [context]
   * @returns {import("../AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  furnish(room, context = {}) {
    const thickness = context.wallThickness ?? room.wallThickness ?? 0.25;
    const openings = (context.openings ?? room.openings ?? []).filter(/**
     * @param {import("../../CastleBasePlanGenerator.js").CompiledCastleOpening} opening
     */
      opening => {
        if (opening.floorY !== room.floorY) { return false; }
        const crosswise = opening.axis === "x";
        const low = crosswise ? room.minX : room.minZ;
        const high = crosswise ? room.maxX : room.maxZ;
        const alongLow = crosswise ? room.minZ : room.minX;
        const alongHigh = crosswise ? room.maxZ : room.maxX;
        return (Math.abs(opening.coordinate - low) <= thickness || Math.abs(opening.coordinate - high) <= thickness) &&
        opening.center + opening.width / 2 > alongLow && opening.center - opening.width / 2 < alongHigh;
      });
    const stairs = (context.stairs ?? room.stairs ?? []).filter(/**
     * @param {{from:number,to:number}} stair
     */ stair => room.level >= stair.from && room.level <= stair.to);
    const mirrored = room.maxZ - room.minZ > room.maxX - room.minX &&
      (room.maxZ - room.minZ) * (room.maxX - room.minX) > 18;
    const center = room.minZ + room.maxZ;
    // Solve against reflected doorways first, then reflect the furnishings back.
    // This swaps the two ends without moving an architectural opening.
    const items = new RoyalBedroomFurnishing(room, {
      seed: context.seed ?? room.furnishingSeed ?? 0,
      wallThickness: thickness,
      openings: mirrored ? openings.map(/**
       * @param {import("../../CastleBasePlanGenerator.js").CompiledCastleOpening} opening
       */ opening => ({
          ...opening,
          ...(opening.axis === "z" ? {
            coordinate: center - opening.coordinate,
            side: opening.side === "NORTH" ? "SOUTH" : "NORTH",
          } : { center: center - opening.center }),
        })) : openings,
      stairs: mirrored ? stairs.map(/**
       * @param {{minZ:number,maxZ:number}} stair
       */ stair => ({
          ...stair,
          minZ: center - stair.maxZ,
          maxZ: center - stair.minZ,
        })) : stairs,
    }).items;
    if (mirrored) {
      for (const item of items) {
        item.z = center - item.z;
        item.rotation = (180 - (item.rotation ?? 0) + (item.mirrorRotationOffset ?? 0) + 360) % 360;
      }
    }
    return items;
  }
}
