/**
 * Uniform visual and collider tuning measured in model-calibration.json.
 */
export class BellBugCalibration {
  /**
   * @returns {number}
   */
  static get scale() {
    return 0.605;
  }
  /**
   * @returns {number}
   */
  static get y() {
    return 0.0116 * this.scale;
  }
  /**
   * @returns {number}
   */
  static get z() {
    return 0.0071 * this.scale;
  }
  /**
   * @returns {number}
   */
  static get yaw() {
    return 180;
  }
  /**
   * @returns {number}
   */
  static get groundClearance() {
    return 0.012 * this.scale;
  }
  /**
   * @returns {number}
   */
  static get spacingRadius() {
    return 0.45;
  }
  /**
   * @returns {number}
   */
  static get radius() {
    return 0.42 * this.scale;
  }
  /**
   * @returns {number}
   */
  static get height() {
    return 0.85 * this.scale;
  }
}
