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
}
