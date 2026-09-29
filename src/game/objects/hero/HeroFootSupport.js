import { FOOT_SIDE } from "../../enum/FootSide.js";
import {
  STEP_CLEARANCE,
  MAX_SAFE_STEP_DOWN,
  FOOT_FORWARD_OFFSET,
  FOOT_LATERAL_OFFSET,
  FOOT_HALF_LENGTH,
  FOOT_HALF_WIDTH,
  FOOT_REQUIRED_PERIMETER_SUPPORTS,
  LANDING_BACKTRACK_STEP,
  LANDING_FORWARD_SETTLE_DISTANCE,
} from "./HeroSurfaceRules.js";

/**
 * @typedef {Pick<import("./HeroTerrain.js").HeroTerrain, "supportHeightAtPoint">} FootSupportSurface
 */

export class HeroFootSupport {
  /**
   * @type {FootSupportSurface}
   */
  #terrain;

  /**
   * Tests the planted boot footprint, independently of animated foot placement.
   * @param {FootSupportSurface} terrain
   * @returns {function Object() { [native code] }}
   */
  constructor(terrain) {
    this.#terrain = terrain;
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} elevation
   * @param {{x: number, z: number}} direction
   * @param {string} alternateFoot
   * @returns {string|null}
   */
  unsupportedFootAt(x, z, elevation, direction, alternateFoot = FOOT_SIDE.LEFT) {
    const support = this.#feetSupportAt(x, z, elevation, direction);
    if (support.left && support.right) {
      return null;
    }
    if (!support.left && support.right) {
      return FOOT_SIDE.LEFT;
    }
    if (support.left && !support.right) {
      return FOOT_SIDE.RIGHT;
    }
    return alternateFoot;
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} elevation
   * @param {{x: number, z: number}} direction
   * @returns {{left: boolean, right: boolean}}
   */
  #feetSupportAt(x, z, elevation, direction) {
    const rightX = direction.z;
    const rightZ = -direction.x;
    const forwardX = direction.x * FOOT_FORWARD_OFFSET;
    const forwardZ = direction.z * FOOT_FORWARD_OFFSET;
    return {
      left: this.#footHasSupport(
        x + forwardX - rightX * FOOT_LATERAL_OFFSET,
        z + forwardZ - rightZ * FOOT_LATERAL_OFFSET,
        elevation,
        direction,
        rightX,
        rightZ,
      ),
      right: this.#footHasSupport(
        x + forwardX + rightX * FOOT_LATERAL_OFFSET,
        z + forwardZ + rightZ * FOOT_LATERAL_OFFSET,
        elevation,
        direction,
        rightX,
        rightZ,
      ),
    };
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} elevation
   * @param {{x: number, z: number}} direction
   * @returns {boolean}
   */
  #bothFootCentersSupportedAt(x, z, elevation, direction) {
    const rightX = direction.z;
    const rightZ = -direction.x;
    const forwardX = direction.x * FOOT_FORWARD_OFFSET;
    const forwardZ = direction.z * FOOT_FORWARD_OFFSET;
    return (
      this.#supportMatchesElevation(
        x + forwardX - rightX * FOOT_LATERAL_OFFSET,
        z + forwardZ - rightZ * FOOT_LATERAL_OFFSET,
        elevation,
      ) &&
      this.#supportMatchesElevation(
        x + forwardX + rightX * FOOT_LATERAL_OFFSET,
        z + forwardZ + rightZ * FOOT_LATERAL_OFFSET,
        elevation,
      )
    );
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} elevation
   * @param {{x: number, z: number}} direction
   * @returns {{x: number, z: number}|null}
   */
  fullySupportedPositionAhead(x, z, elevation, direction) {
    if (!this.#bothFootCentersSupportedAt(x, z, elevation, direction)) {
      return null;
    }
    for (
      let distance = LANDING_BACKTRACK_STEP;
      distance <= LANDING_FORWARD_SETTLE_DISTANCE;
      distance += LANDING_BACKTRACK_STEP
    ) {
      const candidate = {
        x: x + direction.x * distance,
        z: z + direction.z * distance,
      };
      if (
        !this.unsupportedFootAt(
          candidate.x,
          candidate.z,
          elevation,
          direction,
        )
      ) {
        return candidate;
      }
    }
    return null;
  }

  /**
   *
   * @param {number} centerX
   * @param {number} centerZ
   * @param {number} elevation
   * @param {{x: number, z: number}} direction
   * @param {number} rightX
   * @param {number} rightZ
   * @returns {boolean}
   */
  #footHasSupport(
    centerX,
    centerZ,
    elevation,
    direction,
    rightX,
    rightZ,
  ) {
    if (
      !this.#supportMatchesElevation(
        centerX,
        centerZ,
        elevation,
      )
    ) {
      return false;
    }

    /**
     *
     * @param {number} forward
     * @param {number} right
     */
    const supportAtOffset = (forward, right) =>
      this.#supportMatchesElevation(
        centerX +
          direction.x * forward +
          rightX * right,
        centerZ +
          direction.z * forward +
          rightZ * right,
        elevation,
      );
    const supportedPerimeterPoints = [
      supportAtOffset(FOOT_HALF_LENGTH, -FOOT_HALF_WIDTH),
      supportAtOffset(FOOT_HALF_LENGTH, FOOT_HALF_WIDTH),
      supportAtOffset(0, -FOOT_HALF_WIDTH),
      supportAtOffset(0, FOOT_HALF_WIDTH),
      supportAtOffset(-FOOT_HALF_LENGTH, -FOOT_HALF_WIDTH),
      supportAtOffset(-FOOT_HALF_LENGTH, FOOT_HALF_WIDTH),
    ].filter(Boolean).length;
    return (
      supportedPerimeterPoints >= FOOT_REQUIRED_PERIMETER_SUPPORTS
    );
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} elevation
   * @returns {boolean}
   */
  #supportMatchesElevation(x, z, elevation) {
    const supportHeight = this.#terrain.supportHeightAtPoint(
      x,
      z,
      elevation + STEP_CLEARANCE,
    );
    return (
      supportHeight !== null &&
      Math.abs(supportHeight - elevation) <= STEP_CLEARANCE
    );
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} elevation
   * @param {{x: number, z: number}} direction
   * @returns {boolean}
   */
  isSafeDescentAt(x, z, elevation, direction) {
    const rightX = direction.z;
    const rightZ = -direction.x;
    const frontOffset = FOOT_FORWARD_OFFSET + FOOT_HALF_LENGTH;
    const frontX = x + direction.x * frontOffset;
    const frontZ = z + direction.z * frontOffset;
    const maximumHeight = elevation + STEP_CLEARANCE;
    const leftHeight = this.#terrain.supportHeightAtPoint(
      frontX - rightX * FOOT_LATERAL_OFFSET,
      frontZ - rightZ * FOOT_LATERAL_OFFSET,
      maximumHeight,
    );
    const rightHeight = this.#terrain.supportHeightAtPoint(
      frontX + rightX * FOOT_LATERAL_OFFSET,
      frontZ + rightZ * FOOT_LATERAL_OFFSET,
      maximumHeight,
    );
    if (leftHeight === null || rightHeight === null) {
      return false;
    }
    return (
      leftHeight < elevation - STEP_CLEARANCE &&
      rightHeight < elevation - STEP_CLEARANCE &&
      elevation - leftHeight <= MAX_SAFE_STEP_DOWN &&
      elevation - rightHeight <= MAX_SAFE_STEP_DOWN &&
      Math.abs(leftHeight - rightHeight) <= STEP_CLEARANCE
    );
  }
}
