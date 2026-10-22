const RESPONSE = 14;
const SURFACE_TOLERANCE = 0.02;
const SOLE_CLEARANCE = 0.015;

/**
 * Keeps a capsule step assist from becoming a visible hop before reaching a tread.
 */
export class HeroStepPresentation {
  /**
   * @param {number} offset
   * @param {number} bodyHeight
   * @param {number|null} supportHeight
   * @param {number|null} lowerSupportHeight
   * @param {number} deltaTime
   * @param {number} maximumLift
   * @returns {number}
   */
  static update(offset, bodyHeight, supportHeight, lowerSupportHeight, deltaTime, maximumLift) {
    if (Number.isFinite(supportHeight) && Number.isFinite(lowerSupportHeight) &&
      supportHeight <= lowerSupportHeight + SURFACE_TOLERANCE &&
      supportHeight < bodyHeight - SOLE_CLEARANCE) {
      // Follow actual Ammo support while hovering over the lower tread. This
      // also cancels the visual drop if a short tap stops before the riser.
      return Math.max(-maximumLift, supportHeight + SOLE_CLEARANCE - bodyHeight);
    }

    return offset * Math.exp(-RESPONSE * deltaTime);
  }
}
