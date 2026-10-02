import { AbstractCastleRoomGenerator } from "./AbstractCastleRoomGenerator.js";

/**
 * A stair is a vertical connecting subroom, created after both endpoints exist.
 */
export class StairwellRoomGenerator extends AbstractCastleRoomGenerator {
  /**
   * @param {string} id
   */
  constructor(id) { super(id, { x: 3, y: 3 }, { x: 3, y: 3 }); }

  /**
   * @param {import("./AbstractCastleRoomGenerator.js").PlannedCastleRoom|null} from
   * @param {import("./AbstractCastleRoomGenerator.js").PlannedCastleRoom|null} to
   * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} bounds
   * @returns {{id:string,fromRoomId:string,toRoomId:string,fromLevel:number,toLevel:number,minX:number,maxX:number,minZ:number,maxZ:number,floorY:number,height:number,ceilingY:number}|null}
   */
  connect(from, to, bounds) {
    if (!from || !to || from.floorY >= to.floorY ||
      bounds.maxX - bounds.minX < this.min.x || bounds.maxZ - bounds.minZ < this.min.y) { return null; }
    return { ...bounds, id: this.id, fromRoomId: from.id, toRoomId: to.id,
      fromLevel: from.level, toLevel: to.level, floorY: from.floorY,
      height: to.floorY - from.floorY, ceilingY: to.floorY + 2.25 };
  }
}
