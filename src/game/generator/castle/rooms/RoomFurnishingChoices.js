/**
 * Independent seeded preferences. Adding decoration never changes a bed's choices.
 * These only order candidates; the owning placer still validates every position.
 */
export class RoomFurnishingChoices {
  /**
   * @template T
   * @param {T[]} values
   * @param {import("./AbstractCastleRoomGenerator.js").PlannedCastleRoom} room
   * @param {string} purpose
   * @param {string|number} [seed]
   * @returns {T[]}
   */
  static order(values, room, purpose, seed = room.furnishingSeed ?? 0) {
    let state = 2166136261;
    for (const character of `${seed}:${room.id}:${room.level}:${purpose}`) {
      state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
    }
    const result = [...values];
    for (let index = result.length - 1; index > 0; index--) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      const next = Math.floor(state / 4294967296 * (index + 1));
      [result[index], result[next]] = [result[next], result[index]];
    }

    return result;
  }
}
