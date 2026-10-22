import { Vec2 } from "playcanvas";

/**
 * Preserve the cardinal bindings while retaining diagonal and analog angles.
 * @param {number} inputX
 * @param {number} inputY
 * @param {number} rotation
 * @returns {Vec2}
 */
export function projectIsometricMovement(inputX, inputY, rotation) {
  const length = Math.max(1, Math.hypot(inputX, inputY));
  const yaw = rotation * Math.PI / 2;

  return new Vec2(
    (-Math.sin(yaw) * inputX - Math.cos(yaw) * inputY) / length,
    (-Math.cos(yaw) * inputX + Math.sin(yaw) * inputY) / length,
  );
}
