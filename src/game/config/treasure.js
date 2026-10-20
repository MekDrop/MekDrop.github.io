export const TREASURE_TOOL_MAX_TURN = 30;
// Calibrated to the planted circle in the rendered hero's eight-stroke Dig clip.
export const TREASURE_TOOL_MIN_DISTANCE = 0.535;
export const TREASURE_DIG_STROKES = 8;
export const TREASURE_FILL_SCOOPS = 2;
export const TREASURE_FILL_STROKES = TREASURE_FILL_SCOOPS + 1;
export const SHOVEL_FILL_SCOOP_TIME = 0.4;
export const SHOVEL_FILL_RELEASE_TIME = 1.03;
export const SHOVEL_LEVEL_DURATION = 3.2;
export const SHOVEL_LEVEL_IMPACT_TIME = 2.56;

/**
 * Distance to back straight away from a nearby tile before aiming at its center.
 * @param {number} dx
 * @param {number} dz
 * @param {number} facingX
 * @param {number} facingZ
 * @param {number} minimumDistance
 * @param {number} maxTurn
 * @returns {number|null}
 */
export function treasureToolBackstep(dx, dz, facingX, facingZ, minimumDistance, maxTurn) {
  const distance = Math.hypot(dx, dz);
  const forward = dx * facingX + dz * facingZ;
  const sideways = Math.abs(dx * facingZ - dz * facingX);
  const angle = Math.min(89.999, maxTurn) * Math.PI / 180;
  const requiredForward = Math.max(
    Math.sqrt(Math.max(0, minimumDistance ** 2 - sideways ** 2)),
    sideways / Math.tan(angle),
  );
  const step = Math.max(0, requiredForward - forward);

  // Only reposition around a close tile; never back across a whole tile to aim.
  return distance <= minimumDistance && step <= 0.85 ? step : null;
}
