import { Vec2 } from "playcanvas";
import { treasureToolBackstep } from "../../../config/treasure.js";
import { MOVEMENT_COLLISION_RADIUS } from "./HeroSurfaceRules.js";

/**
 * Plans supported tool stances without retaining Hero or action state.
 * Returned paths belong to the action; HeroToolStep consumes their progress.
 */
export class HeroToolStancePlanner {
  /**
   * Position before a tool stroke, checking the complete short approach for obstacles.
   * @param {{position: import("playcanvas").Vec3, facingYaw: number, movementSurface: import("./HeroMovementSurface.js").HeroMovementSurface, surfaceState: import("./HeroSurfaceTypes.js").MovementSurfaceState, canOccupy: (x: number, z: number) => boolean}} state
   * @param {{x: number, y: number, z: number}} target
   * @param {number} minimumDistance
   * @param {number} maxTurn
   * @param {boolean} [exactDistance]
   * @param {boolean} [allowOccupiedStance]
   * @param {Array<{yaw: number, context: Record<string, string|number|boolean>}>|null} [stances]
   * @param {number} [maximumTravel]
   * @returns {{startX:number,startZ:number,targetX:number,targetZ:number,travel?:number,context?:Record<string,string|number|boolean>,waypoints?:Vec2[],lengths?:number[]}|false|null}
   */
  static plan({ position, facingYaw, movementSurface, surfaceState, canOccupy }, target, minimumDistance, maxTurn, exactDistance = false, allowOccupiedStance = false, stances = null, maximumTravel = 0.85) {
    if (exactDistance) {
      // A planted stroke needs level body support, unlike a walking step.
      const candidates = [];
      const nearestYaw = Math.atan2(target.x - position.x, target.z - position.z);
      for (let index = 0; index < (stances?.length ?? 360); index += 1) {
        const yaw = stances ? stances[index].yaw : nearestYaw + index * Math.PI / 180;
        const targetX = target.x - Math.sin(yaw) * minimumDistance;
        const targetZ = target.z - Math.cos(yaw) * minimumDistance;
        const travel = Math.hypot(targetX - position.x, targetZ - position.z);
        if (travel <= maximumTravel) {
          candidates.push({
            startX: position.x,
            startZ: position.z,
            targetX,
            targetZ,
            travel,
            context: stances?.[index].context,
          });
        }
      }
      candidates.sort(HeroToolStancePlanner.#compareToolPositions);
      for (const candidate of candidates) {
        // The grounded hero already occupies this stance. Sweeping a capsule
        // across the adjacent open hole can reject even a zero-length move.
        if (allowOccupiedStance && candidate.travel < 0.002) {
          return stances ? candidate : null;
        }
        const destination = {
          x: candidate.targetX,
          y: position.y,
          z: candidate.targetZ,
        };
        if (movementSurface.canEscapeAcross(position, destination, surfaceState,
          stances ? MOVEMENT_COLLISION_RADIUS : 0.48)) {
          return candidate.travel < 0.002 && !stances ? null : candidate;
        }
        if (stances) {
          // Follow the rim instead of cutting across the open cavity.
          const startYaw = Math.atan2(position.x - target.x, position.z - target.z);
          const endYaw = Math.atan2(candidate.targetX - target.x, candidate.targetZ - target.z);
          const turn = Math.atan2(Math.sin(endYaw - startYaw), Math.cos(endYaw - startYaw));
          const count = Math.max(1, Math.ceil(Math.abs(turn) / (Math.PI / 36)));
          const waypoints = [new Vec2(position.x, position.z)];
          const lengths = [0];
          let supported = true;
          for (let step = 0; step <= count; step += 1) {
            const angle = startYaw + turn * step / count;
            const point = new Vec2(target.x + Math.sin(angle) * minimumDistance,
              target.z + Math.cos(angle) * minimumDistance);
            const previous = waypoints[waypoints.length - 1];
            const from = {
              x: previous.x,
              y: position.y,
              z: previous.y,
            };
            const to = {
              x: point.x,
              y: position.y,
              z: point.y,
            };
            if (!movementSurface.canEscapeAcross(from, to, surfaceState, MOVEMENT_COLLISION_RADIUS)) {
              supported = false;
              break;
            }
            lengths.push(lengths[lengths.length - 1] + point.distance(previous));
            waypoints.push(point);
          }
          if (supported) {
            return {
              ...candidate,
              waypoints,
              lengths,
            };
          }
        }
      }

      return false;
    }
    const dx = target.x - position.x;
    const dz = target.z - position.z;
    const distance = Math.hypot(dx, dz);
    if (distance >= minimumDistance && !exactDistance) {
      return null;
    }
    const yaw = facingYaw * Math.PI / 180;
    const facingX = Math.sin(yaw);
    const facingZ = Math.cos(yaw);
    const adjustment = distance >= minimumDistance ? 0
      : treasureToolBackstep(dx, dz, facingX, facingZ, minimumDistance, maxTurn);
    if (adjustment === null) {
      return false;
    }
    let targetX = position.x - facingX * adjustment;
    let targetZ = position.z - facingZ * adjustment;
    const travel = Math.hypot(targetX - position.x, targetZ - position.z);
    if (travel < 0.002) {
      return null;
    }
    if (travel > maximumTravel) {
      return false;
    }
    const steps = Math.ceil(travel / 0.05);
    for (let step = 1; step <= steps; step += 1) {
      const progress = step / steps;
      if (!canOccupy(
        position.x + (targetX - position.x) * progress,
        position.z + (targetZ - position.z) * progress,
      )) {
        return false;
      }
    }

    return {
      startX: position.x,
      startZ: position.z,
      targetX,
      targetZ,
    };
  }

  /**
   * @param {{travel: number}} a
   * @param {{travel: number}} b
   * @returns {number}
   */
  static #compareToolPositions(a, b) {
    return a.travel - b.travel;
  }

}
