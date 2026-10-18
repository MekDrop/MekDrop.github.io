import { GardenTerraceRoomGenerator } from "./rooms/terrace/GardenTerraceRoomGenerator.js";
import { CASTLE_TERRACE_STYLE } from "../../enum/CastleTerraceStyle.js";

/**
 * Seeded finishes for plans that explicitly opt into the garden terrace generator.
 * This changes surface assignments only, never masonry, collision or openings.
 */
export class CastleTerraceAppearance {
  /**
   * @param {import("../../GameContracts.js").CastleBuildPlan} plan
   * @returns {import("../../GameContracts.js").CastleBuildPlan}
   */
  static apply(plan) {
    const residential = plan.metadata.runtime.residential;
    const terrace = residential.spaces.find(CastleTerraceAppearance.#isGarden);
    if (!terrace) {
      return plan;
    }
    const style = GardenTerraceRoomGenerator.styleFor(plan.input.seed);
    residential.terraceStyle = style;
    plan.metadata.runtime.materialColors = style === CASTLE_TERRACE_STYLE.ROYAL_GARDEN ? {
      castleStoneMid: 0xa59b82,
      castleStoneDark: 0x918974,
      castleStoneLight: 0xc9bb9b,
      castleArchStone: 0xc7b699,
    } : {
      castleStoneMid: 0x969080,
      castleStoneDark: 0x7f7b6c,
      castleStoneLight: 0xb3a68c,
      castleArchStone: 0xb9aa8c,
    };
    if (style === CASTLE_TERRACE_STYLE.STORYBOOK) {
      for (const box of plan.geometry.boxes) {
        // Coherent repair patches, rather than an independently random brick on
        // every cell. Keep corners, trims, floors and the tower roof untouched.
        if (box.material !== "castleStoneMid" || box.y < plan.layout.baseY + 0.4 ||
          box.y > terrace.floorY - 0.45) {
          continue;
        }
        const patch = Math.imul(Math.floor(box.x / 1.25), 31) ^
          Math.imul(Math.floor(box.z / 1.25), 17) ^ Math.floor(box.y / 0.75);
        if ((patch >>> 0) % 9 === 0) {
          box.material = "castleTerraceBrick";
        }
      }
    }

    return plan;
  }

  /**
   * @param {import("./CastleBasePlanGenerator.js").CompiledCastleSpace} room
   * @returns {boolean}
   */
  static #isGarden(room) {
    return room.generator === GardenTerraceRoomGenerator.name;
  }
}
