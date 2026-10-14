import { CastleRoomSizeInvalidError } from "../../../errors/castle/index.js";

/**
 * @typedef {{x:number,y:number}} RoomSize Horizontal dimensions in metres.
 * @typedef {{id:string,minX:number,maxX:number,minZ:number,maxZ:number,floorY:number,level:number,floorSpan:number,height:number,purpose:string,furnishingSeed?:string|number,stairHost?:boolean,floorFinish?:string,furnish?:boolean,contentBounds?:{minX:number,maxX:number,minZ:number,maxZ:number}}} PlannedCastleRoom
 * @typedef {{role:string,x:number,z:number,width:number,depth:number,scale:number,object?:string,rotation?:number,y?:number,height?:number,elevation?:number,floorCovering?:boolean,placementIssue?:string,wallAttachment?:boolean,wallInset?:number,wallMountBack?:number,supportId?:string,underSupport?:boolean,id?:string,floorY?:number,mirrorRotationOffset?:number,stretch?:{x:number,y:number,z:number}}} RoomItem
 */

/**
 * Room generators declare size requirements; furnishing runs after placement.
 * @abstract
 */
export class AbstractCastleRoomGenerator {
  /**
   * @param {string} id
   * @param {RoomSize} min
   * @param {RoomSize} [max] Omitted means no upper size constraint.
   */
  constructor(id, min, max) {
    if (!min || !Number.isFinite(min.x) || !Number.isFinite(min.y) || min.x <= 0 || min.y <= 0 ||
      (max && (!Number.isFinite(max.x) || !Number.isFinite(max.y) || max.x < min.x || max.y < min.y))) {
      throw new CastleRoomSizeInvalidError(id);
    }
    /**
     * @type {string}
     */
    this.id = id;
    /**
     * @type {RoomSize}
     */
    this.min = min;
    /**
     * @type {RoomSize|undefined}
     */
    this.max = max;
  }

  /**
   * @returns {number[]} Floor preference, with ground first.
   */
  get levels() { return [0, 1]; }

  /**
   * @returns {number} Number of storeys occupied by this room.
   */
  get floorSpan() { return 1; }

  /**
   * @param {PlannedCastleRoom} room
   * @returns {RoomItem[]}
   */
  furnish(room) {
    void room;
    return [];
  }
}
