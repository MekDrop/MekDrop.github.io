import { AbstractCastleRoomGenerator } from "./AbstractCastleRoomGenerator.js";

export class LeisureRoomGenerator extends AbstractCastleRoomGenerator {
  /**
   * @type {boolean}
   */
  #courtyard;

  /**
   * @param {{courtyard?:boolean}} options
   */
  constructor({ courtyard = false } = {}) {
    super("leisure", courtyard ? { x: 3, y: 6 } : { x: 3, y: 3 },
      courtyard ? { x: 4, y: 6 } : { x: 4, y: 4.5 });
    this.#courtyard = courtyard;
  }
  /**
   * One outdoor leisure area: a large ground courtyard or an open upper terrace.
   * @returns {number[]}
   */
  get levels() { return this.#courtyard ? [0] : [1]; }
  /**
   * @param {import("./AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @returns {import("./AbstractCastleRoomGenerator.js").RoomItem[]}
   */
  furnish() {
    return [];
  }
}
