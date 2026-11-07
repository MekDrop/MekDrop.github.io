import { ENEMY_TRAVERSAL } from "../enum/EnemyTraversal.js";

/**
 * Small ground enemies occupy one of the two tile-wide path lanes.
 */
export class EnemyPathLane {
  /**
   * @type {import("../objects/enemies/shared/Enemy.js").Enemy}
   */
  owner;
  /**
   * @type {number}
   */
  side;

  /**
   * @param {import("../objects/enemies/shared/Enemy.js").Enemy} owner
   */
  constructor(owner) {
    this.owner = owner;
    let hash = 0;
    for (const character of String(owner.definition.id)) {
      hash = (hash * 31 + character.charCodeAt(0)) | 0;
    }
    this.side = (hash & 1) === 0 ? -1 : 1;
  }

  /**
   * Offset route cursors too, so their arrival checks use the chosen lane.
   * @param {import("./WalkingPaths.js").WalkingPoint[]} route
   * @param {number} index
   * @returns {import("playcanvas").Vec3}
   */
  routePoint(route, index) {
    const owner = this.owner;
    const map = owner.runtime.mapData;
    const point = route[index];
    const before = route[Math.max(0, index - 1)];
    const after = route[Math.min(route.length - 1, index + 1)];
    const dx = Math.sign(after.col - before.col);
    const dz = Math.sign(after.row - before.row);
    const offset = owner.usesPathLanes !== false && owner.radius <= 0.5 && owner.traversalCapability !== ENEMY_TRAVERSAL.FLYING ? this.side * 0.5 : 0;

    return new owner.pc.Vec3(
      point.col - (map.cols - 1) / 2 - dz * offset,
      point.elevation,
      point.row - (map.rows - 1) / 2 + dx * offset,
    );
  }

  /**
   * Keep local combat approaches and off-path movement under their own planners.
   * @param {import("playcanvas").Vec3} goal
   * @returns {import("playcanvas").Vec3}
   */
  next(goal) {
    const owner = this.owner;
    const map = owner.runtime.mapData;
    const position = owner.position;
    if (!map || owner.usesPathLanes === false || owner.radius > 0.5 || owner.traversalCapability === ENEMY_TRAVERSAL.FLYING ||
      Math.hypot(goal.x - position.x, goal.z - position.z) < 0.8) {
      return goal;
    }
    let nearest = 0.9;
    let result = goal;
    let normal = null;
    for (const path of map.paths ?? []) {
      for (let index = 1; index < path.route.length; index++) {
        const first = path.route[index - 1];
        const second = path.route[index];
        const dx = second.col - first.col;
        const dz = second.row - first.row;
        const length = Math.hypot(dx, dz);
        if (length < 0.001 || Math.abs(first.elevation - position.y) > 0.6) {
          continue;
        }
        const x = first.col - (map.cols - 1) / 2;
        const z = first.row - (map.rows - 1) / 2;
        const along = ((position.x - x) * dx + (position.z - z) * dz) / length;
        const fraction = Math.max(0, Math.min(1, along / length));
        const distance = Math.hypot(position.x - x - dx * fraction, position.z - z - dz * fraction);
        const forward = (goal.x - position.x) * dx + (goal.z - position.z) * dz;
        if (distance >= nearest || Math.abs(forward) < 0.001 ||
          (forward > 0 && along >= length - 0.08) || (forward < 0 && along <= 0.08)) {
          continue;
        }
        nearest = distance;
        normal = new owner.pc.Vec3(-dz / length, 0, dx / length);
        const sign = Math.sign(forward);
        const ahead = Math.max(0, Math.min(length, along + sign * 0.65));
        result = new owner.pc.Vec3(
          x + dx / length * ahead - dz / length * this.side * 0.5,
          first.elevation + (second.elevation - first.elevation) * fraction,
          z + dz / length * ahead + dx / length * this.side * 0.5,
        );
      }
    }

    if (result === goal || this.#clear(result)) {
      return result;
    }
    // Cross sideways before advancing past the blocker. Persist the new side
    // so route arrival cursors and subsequent frames agree with the maneuver.
    const alternate = result.clone();
    const direction = result.clone().sub(position);
    // The lane normal follows the selected path segment, not the actor's yaw.
    const routeDirection = normal;
    alternate.x -= routeDirection.x * this.side;
    alternate.z -= routeDirection.z * this.side;
    const crossing = alternate.clone().sub(direction);
    if (this.#clear(crossing) && this.#clear(alternate, crossing)) {
      this.side *= -1;

      return crossing;
    }

    return position.clone();
  }

  /**
   * Test the swept footprint so neither crossing nor following pushes peers.
   * Ammo still owns physical contact response; this only chooses AI intent.
   * @param {import("playcanvas").Vec3} end
   * @param {import("playcanvas").Vec3} start
   * @returns {boolean}
   */
  #clear(end, start = this.owner.position) {
    const owner = this.owner;
    const dx = end.x - start.x, dz = end.z - start.z;
    const lengthSq = dx * dx + dz * dz;
    for (const actor of owner.actors ?? []) {
      if (actor === owner || !actor.isEnemy || !actor.alive || actor.carrier || actor.airborne ||
        actor.entity?.rigidbody?.enabled === false) {
        continue;
      }
      const point = actor.position;
      if (!point || point.y >= start.y + (owner.height ?? 1) ||
        point.y + (actor.height ?? 1) <= start.y) {
        continue;
      }
      const fraction = lengthSq ? Math.max(0, Math.min(1,
        ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSq)) : 0;
      const clearance = owner.radius + (actor.radius ?? 0.3) + 0.05;
      // Contact can leave actors within steering clearance. Allow a strictly
      // separating sweep so this guard cannot trap both bodies in place.
      const separating = (start.x - point.x) * dx + (start.z - point.z) * dz > 0;
      if (Math.hypot(point.x - start.x, point.z - start.z) < clearance && separating) {
        continue;
      }
      if (Math.hypot(point.x - start.x - dx * fraction, point.z - start.z - dz * fraction) <
        clearance) {
        return false;
      }
    }
    const physics = owner.app?.systems?.rigidbody;
    if (physics?.raycastAll && lengthSq > 0) {
      const length = Math.sqrt(lengthSq);
      for (const offset of [-owner.radius, 0, owner.radius]) {
        const from = start.clone().add(new owner.pc.Vec3(-dz / length * offset, 0.35, dx / length * offset));
        const to = end.clone().add(new owner.pc.Vec3(-dz / length * offset, 0.35, dx / length * offset));
        for (const hit of physics.raycastAll(from, to)) {
          if (hit.entity !== owner.entity && !hit.entity.isDescendantOf?.(owner.entity) &&
            hit.entity.rigidbody?.type === "static" && Math.abs(hit.normal?.y ?? 0) < 0.8) {
            return false;
          }
        }
      }
    }
    return true;
  }
}
