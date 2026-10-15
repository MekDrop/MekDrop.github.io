import { AbstractCastleRoomGenerator } from "../AbstractCastleRoomGenerator.js";
import { LibraryRoomFurnishing } from "./LibraryRoomFurnishing.js";

export class LibraryRoomGenerator extends AbstractCastleRoomGenerator {
  constructor() { super("library", { x: 1.75, y: 2 }, { x: 6, y: 4.5 }); }
  /**
   * @param {import("../AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @param {{seed?:string|number,openings?:import("../../CastleBasePlanGenerator.js").CompiledCastleOpening[],stairs?:Array<{from:number,to:number,minX:number,maxX:number,minZ:number,maxZ:number}>,wallThickness?:number}} [context]
   * @returns {import("../AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  furnish(room, context = {}) {
    return new LibraryRoomFurnishing({ ...room, seed: context.seed ?? room.furnishingSeed,
      wallThickness: context.wallThickness, openings: (context.openings ?? room.openings ?? [])
        .filter(/**
         *
         * @param {import("../../CastleBasePlanGenerator.js").CompiledCastleOpening} opening
         */
        opening => opening.roomId === room.id && opening.floorY === room.floorY),
      stairs: (context.stairs ?? room.stairs ?? []).filter(/**
       *
       * @param {{from:number,to:number}} stair
       */
      stair => room.level >= stair.from && room.level <= stair.to) }).items;
  }
}

