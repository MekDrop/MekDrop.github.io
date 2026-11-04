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
    const offset = owner.radius <= 0.5 && owner.traversalCapability !== ENEMY_TRAVERSAL.FLYING ? this.side * 0.5 : 0;

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
    if (!map || owner.radius > 0.5 || owner.traversalCapability === ENEMY_TRAVERSAL.FLYING ||
      Math.hypot(goal.x - position.x, goal.z - position.z) < 0.8) {
      return goal;
    }
    let nearest = 0.9;
    let result = goal;
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
        const sign = Math.sign(forward);
        const ahead = Math.max(0, Math.min(length, along + sign * 0.65));
        result = new owner.pc.Vec3(
          x + dx / length * ahead - dz / length * this.side * 0.5,
          first.elevation + (second.elevation - first.elevation) * fraction,
          z + dz / length * ahead + dx / length * this.side * 0.5,
        );
      }
    }

    return result;
  }
}
