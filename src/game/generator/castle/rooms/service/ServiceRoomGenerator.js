import { Vec2 } from "playcanvas";
import { AbstractCastleRoomGenerator } from "../AbstractCastleRoomGenerator.js";
import { ServiceRoomFurnishing } from "./ServiceRoomFurnishing.js";

export class ServiceRoomGenerator extends AbstractCastleRoomGenerator {
  constructor() {
    super("service", new Vec2(2, 2.5), new Vec2(4.5, 8));
  }
  /**
   * @returns {number[]}
   */
  get levels() {
    return [0, -1];
  }
  /**
   * @param {import("../AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @param {{seed?:string|number,wallThickness?:number,openings?:Array,stairs?:Array}} [context]
   * @returns {import("../AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  furnish(room, context = {}) {
    return new ServiceRoomFurnishing({
      ...room,
      furnishingSeed: context.seed ?? room.furnishingSeed,
      wallThickness: context.wallThickness ?? room.wallThickness,
      openings: context.openings?.filter(/**
       *
       * @param {import("../../CastleBasePlanGenerator.js").CompiledCastleOpening} opening
       */
        opening => opening.roomId === room.id && opening.floorY === room.floorY) ?? room.openings,
      stairs: context.stairs?.filter(/**
       *
       * @param {{from:number,to:number}} stair
       */
        stair => room.level >= stair.from && room.level <= stair.to) ?? room.stairs,
    }).items;
  }
}
