const TURN_RESPONSE = 14;
const MAX_TURN_SPEED = 540;

/**
 * Coordinates visual turning and ground speed without restarting the gait cycle.
 */
export class HeroTurning {
  /**
   * @param {number} from
   * @param {number} to
   * @returns {number}
   */
  static difference(from, to) {
    return ((to - from) % 360 + 540) % 360 - 180;
  }

  /**
   * @param {number} yaw
   * @param {number} target
   * @param {number} deltaTime
   * @returns {number}
   */
  static advance(yaw, target, deltaTime) {
    const difference = HeroTurning.difference(yaw, target);
    const step = Math.min(
      Math.abs(difference) * (1 - Math.exp(-TURN_RESPONSE * deltaTime)),
      MAX_TURN_SPEED * deltaTime,
    );

    return yaw + Math.sign(difference) * step;
  }

  /**
   * Brake into a sharp pivot, then restore stride speed as the body aligns.
   * @param {number} yaw
   * @param {number} target
   * @returns {number}
   */
  static speedScale(yaw, target) {
    const angle = HeroTurning.difference(yaw, target) * Math.PI / 180;

    return Math.max(0.12, (1 + Math.cos(angle)) / 2);
  }
}
