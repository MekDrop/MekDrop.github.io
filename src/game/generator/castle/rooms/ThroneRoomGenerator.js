import { AbstractCastleRoomGenerator } from "./AbstractCastleRoomGenerator.js";

export class ThroneRoomGenerator extends AbstractCastleRoomGenerator {
  constructor() { super("throneRoom", { x: 3, y: 3 }, { x: 3, y: 3.25 }); }
  /**
   * @returns {number[]}
   */
  get levels() { return [0]; }
  // The existing audience-room object furnishes this room from its final bounds.
}
