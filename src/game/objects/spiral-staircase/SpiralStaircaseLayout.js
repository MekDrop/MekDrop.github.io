import { InvalidSpiralStaircaseError } from "../../errors/spiral-staircase/index.js";

/**
 * Fixed-rise stairs keep successive turns above the hero's head. Z1 and Z2
 * are map elevations (PlayCanvas Y); the final tread lands exactly on Z2.
 */
export class SpiralStaircaseLayout {
  /**
   * @type {number}
   */
  static stepRise = 0.125;
  /**
   * @type {number}
   */
  static stepAngle = 22.5;

  /**
   * @param {import("../ObjectTypes.js").MapObjectDefinition} definition
   * @returns {Array<{height: number, rotation: number}>}
   */
  static steps(definition) {
    const { Z1, Z2, rotation = 0 } = definition;
    if (!Number.isFinite(Z1) || !Number.isFinite(Z2) || Z2 <= Z1 || Z2 - Z1 > 64) {
      throw new InvalidSpiralStaircaseError(definition);
    }
    const count = Math.ceil((Z2 - Z1) / this.stepRise - 1e-8);
    return Array.from({ length: count },
      /**
       * @param {number} unused
       * @param {number} index
       */
      (unused, index) => ({
        height: Math.min(Z2, Z1 + (index + 1) * this.stepRise),
        rotation: rotation + index * this.stepAngle,
      }));
  }
}
