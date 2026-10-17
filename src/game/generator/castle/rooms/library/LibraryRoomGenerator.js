import { Vec2 } from "playcanvas";
import { AbstractCastleRoomGenerator } from "../AbstractCastleRoomGenerator.js";
import { LibraryRoomFurnishing } from "./LibraryRoomFurnishing.js";

export class LibraryRoomGenerator extends AbstractCastleRoomGenerator {
  constructor() {
    super("library", new Vec2(1.75, 2), new Vec2(6, 4.5));
  }
  /**
   * @param {import("../AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @param {{chimneys?:Array<{minX:number,maxX:number,minZ:number,maxZ:number,bottom:number,top:number}>,seed?:string|number,openings?:import("../../CastleBasePlanGenerator.js").CompiledCastleOpening[],stairs?:Array<{from:number,to:number,minX:number,maxX:number,minZ:number,maxZ:number}>,wallThickness?:number}} [context]
   * @returns {import("../AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  furnish(room, context = {}) {
    return new LibraryRoomFurnishing({
      ...room,
      chimneys: context.chimneys ?? room.chimneys,
      seed: context.seed ?? room.furnishingSeed,
      wallThickness: context.wallThickness,
      openings: (context.openings ?? room.openings ?? [])
        .filter(/**
         *
         * @param {import("../../CastleBasePlanGenerator.js").CompiledCastleOpening} opening
         */
          opening => opening.roomId === room.id && opening.floorY === room.floorY),
      stairs: (context.stairs ?? room.stairs ?? []).filter(/**
       *
       * @param {{from:number,to:number}} stair
       */
        stair => room.level >= stair.from && room.level <= stair.to),
    }).items;
  }
}

