import { Vec2 } from "playcanvas";
import { AbstractCastleRoomGenerator } from "../AbstractCastleRoomGenerator.js";

export class LeisureRoomGenerator extends AbstractCastleRoomGenerator {
  /**
   * @type {boolean}
   */
  #courtyard;

  /**
   * @param {{courtyard?:boolean}} options
   */
  constructor({ courtyard = false } = {}) {
    super("leisure", courtyard ? new Vec2(3, 6) : new Vec2(3, 3),
      courtyard ? new Vec2(4, 6) : new Vec2(4, 4.5));

    this.#courtyard = courtyard;
  }
  /**
   * One outdoor leisure area: a large ground courtyard or an open upper terrace.
   * @returns {number[]}
   */
  get levels() { return this.#courtyard ? [0] : [1]; }
  /**
   * @param {import("../AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @param {{openings?:import("../../CastleBasePlanGenerator.js").CompiledCastleOpening[],stairs?:Array<{minX:number,maxX:number,minZ:number,maxZ:number}>}} [context]
   * @returns {import("../AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  furnish(room, context = {}) {
    // Keep the original pair, but leave the entrance landing free.
    if (this.#courtyard || room.kind === "courtyard" || room.level === 0 ||
      room.maxX - room.minX < 2 || room.maxZ - room.minZ < 2) { return []; }
    return [room.minX + 0.6, room.maxX - 0.6].map(/**
     * @param {number} x
     */
      (x) => ({
        role: "leisurePlanter",
        object: "Planter",
        x,
        z: room.maxZ - 0.6,
        width: 0.665,
        depth: 0.665,
        scale: 1,
        rotation: -180,
      })).filter(/**
         * @param {import("../AbstractCastleRoomGenerator.js").RoomItem} item
         */
      (item) => !(context.openings ?? room.openings ?? []).some(/**
         * @param {import("../../CastleBasePlanGenerator.js").CompiledCastleOpening} opening
         */
        (opening) => opening.kind === "door" && opening.floorY === room.floorY &&
            (opening.axis === "x"
              ? Math.abs(item.x - opening.coordinate) < 1.3325 && Math.abs(item.z - opening.center) < opening.width / 2 + 0.6325
              : Math.abs(item.z - opening.coordinate) < 1.3325 && Math.abs(item.x - opening.center) < opening.width / 2 + 0.6325)) &&
          !(context.stairs ?? room.stairs ?? []).some(/**
           * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} stair
           */
            (stair) => item.x + 0.6825 > stair.minX && item.x - 0.6825 < stair.maxX &&
              item.z + 0.6825 > stair.minZ && item.z - 0.6825 < stair.maxZ));
  }
}
