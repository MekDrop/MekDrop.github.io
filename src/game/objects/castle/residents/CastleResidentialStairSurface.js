import { MAX_SAFE_STEP_DOWN, STEP_CLEARANCE } from "../../characters/hero/HeroSurfaceRules.js";
import { spiralStairRise } from "../../shared/SpiralStairCollision.js";
import { castleStraightStairHeight } from "../stairs/CastleStraightStairs.js";

/**
 * Selects reachable surfaces across the residential stair assemblies.
 */
export class CastleResidentialStairSurface {
  /**
   * @param {Array<import("./CastleResidentialLayout.js").ResidentialStair|null>} stairs
   * @param {number} x
   * @param {number} z
   * @param {number} currentElevation
   * @returns {number|null}
   */
  static heightAt(stairs, x, z, currentElevation) {
    let result = null;
    for (const stair of stairs) {
      if (!stair) {
        continue;
      }
      if (stair.straight) {
        const height = castleStraightStairHeight(stair, x, z, currentElevation);
        if (height !== null && (result === null || Math.abs(height - currentElevation) < Math.abs(result - currentElevation))) {
          result = height;
        }
        continue;
      }
      const dx = x - stair.center.x;
      const dz = z - stair.center.z;
      const distance = Math.hypot(dx, dz);
      if (distance < stair.innerRadius || distance > stair.radius * 0.59 / 0.65 || !Number.isFinite(currentElevation)) {
        continue;
      }
      let best = null;
      let difference = Number.POSITIVE_INFINITY;
      const totalAngle = stair.turns * Math.PI * 2;
      const stepAngle = totalAngle / stair.steps;
      const startAngle = Math.PI / 2 - stair.yaw * Math.PI / 180;
      const wrapped = ((startAngle - Math.atan2(dz, dx)) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      for (let angle = wrapped; angle <= totalAngle; angle += Math.PI * 2) {
        const step = Math.min(stair.steps, Math.max(1, Math.ceil(angle / stepAngle)));
        const height = stair.center.y + stair.rise * spiralStairRise(step / stair.steps, stair.landingProfile);
        const heightDifference = Math.abs(height - currentElevation);
        if (heightDifference <= (height > currentElevation ? STEP_CLEARANCE : MAX_SAFE_STEP_DOWN) && heightDifference < difference) {
          best = height; difference = heightDifference;
        }
      }
      if (best !== null && (result === null || Math.abs(best - currentElevation) < Math.abs(result - currentElevation))) {
        result = best;
      }
    }

    return result;
  }
}
