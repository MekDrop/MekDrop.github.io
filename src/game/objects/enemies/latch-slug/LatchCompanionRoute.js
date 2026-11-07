import { MAP_TILE_TYPE } from "../../../enum/MapTileType.js";

/**
 * Bounded local path search for an unoccupied place beside a human.
 * Plans steering targets only; Ammo continues to own movement and contacts.
 */
export class LatchCompanionRoute {
  /**
   * @param {import("./LatchSlug.js").LatchSlug} owner
   * @param {(point: import("playcanvas").Vec3) => boolean} blocked
   */
  constructor(owner, blocked) {
    this.owner = owner;
    this.blocked = blocked;
  }

  /**
   * @returns {boolean}
   */
  get active() {
    return this.#onPath(this.owner.position);
  }

  /**
   * Close an open gap along the current path axis without switching lanes.
   * @param {import("../shared/Enemy.js").EnemyActor} human
   * @returns {import("playcanvas").Vec3|null}
   */
  laneStep(human) {
    const owner = this.owner;
    const target = owner.targetPosition(human);
    if (!target || !this.active || owner.position.distance(target) <= 1.2) {
      return null;
    }
    const left = owner.position.clone(), right = owner.position.clone();
    const back = owner.position.clone(), front = owner.position.clone();
    left.x -= 0.5;
    right.x += 0.5;
    back.z -= 0.5;
    front.z += 0.5;
    const horizontal = this.#onPath(left) && this.#onPath(right);
    const vertical = this.#onPath(back) && this.#onPath(front);
    const axis = horizontal !== vertical ? (horizontal ? "x" : "z")
      : Math.abs(target.x - owner.position.x) >= Math.abs(target.z - owner.position.z) ? "x" : "z";
    const point = owner.position.clone();
    point[axis] += Math.sign(target[axis] - point[axis]) * Math.min(0.25, Math.abs(target[axis] - point[axis]));
    const middle = owner.position.clone().lerp(owner.position, point, 0.5);
    if (point.distance(target) >= owner.position.distance(target) - 0.01 ||
      !this.#clear(point, human) || !this.#clear(middle, human)) {
      return null;
    }

    return point;
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} human
   * @returns {import("playcanvas").Vec3|null}
   */
  next(human) {
    const owner = this.owner;
    const target = owner.targetPosition(human);
    if (!target || !this.#onPath(owner.position)) {
      return null;
    }
    const forward = this.laneStep(human);
    if (forward) {
      return forward;
    }
    if (owner.position.distance(target) <= 1.6 && !this.#nearbySlug()) {
      return owner.position.clone();
    }
    const queue = [{
      point: owner.position.clone(),
      first: null,
      x: 0,
      z: 0,
    }];
    const visited = new Set(["0:0"]);
    for (let index = 0; index < queue.length; index++) {
      const node = queue[index];
      const distance = node.point.distance(target);
      if (distance >= 0.85 && distance <= 1.2 && !this.#occupied(node.point, human)) {
        return node.first ?? node.point;
      }
      for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const x = node.x + dx, z = node.z + dz;
        const key = `${x}:${z}`;
        if (visited.has(key) || Math.abs(x) > 12 || Math.abs(z) > 12) {
          continue;
        }
        visited.add(key);
        const point = owner.position.clone();
        point.x = Math.round(owner.position.x * 4) / 4 + x * 0.25;
        point.z = Math.round(owner.position.z * 4) / 4 + z * 0.25;
        const middle = node.point.clone().lerp(node.point, point, 0.5);
        if (!this.#clear(point, human) || !this.#clear(middle, human)) {
          continue;
        }
        queue.push({
          point,
          first: node.first ?? point,
          x,
          z,
        });
      }
    }

    return null;
  }

  /**
   * Detour only when another slime occupies the approach. A lone slime can
   * remain in its lane instead of circling a human for a slightly closer spot.
   * @returns {boolean}
   */
  #nearbySlug() {
    const owner = this.owner;
    for (const actor of owner.actors) {
      if (actor !== owner && actor.affection && actor.alive !== false && !actor.carrier && !actor.airborne
        && Math.abs(owner.targetPosition(actor).y - owner.position.y) < 0.6
        && owner.targetPosition(actor).distance(owner.position) <= 2.5) {
        return true;
      }
    }

    return false;
  }

  /**
   * @param {import("playcanvas").Vec3} point
   * @returns {boolean}
   */
  #onPath(point) {
    const map = this.owner.runtime?.mapData;
    if (!map?.grid) {
      return false;
    }
    const radius = this.owner.radius;
    for (const [dx, dz] of [[-radius, -radius], [-radius, radius], [radius, -radius], [radius, radius]]) {
      const col = Math.round(point.x + dx + (map.cols - 1) / 2);
      const row = Math.round(point.z + dz + (map.rows - 1) / 2);
      if (![MAP_TILE_TYPE.PATH, MAP_TILE_TYPE.ENTRY].includes(map.grid[row]?.[col])) {
        return false;
      }
      const height = map.heightmap?.[row]?.[col];
      if (Number.isFinite(height) && Math.abs(height - point.y) > 0.3) {
        return false;
      }
    }

    return true;
  }

  /**
   * @param {import("playcanvas").Vec3} point
   * @param {import("../shared/Enemy.js").EnemyActor} human
   * @returns {boolean}
   */
  #clear(point, human) {
    return this.#onPath(point) && !this.#occupied(point, human) && !this.blocked(point);
  }

  /**
   * @param {import("playcanvas").Vec3} point
   * @param {import("../shared/Enemy.js").EnemyActor} human
   * @returns {boolean}
   */
  #occupied(point, human) {
    const owner = this.owner;
    for (const actor of new Set([...owner.actors, human])) {
      if (actor === owner || actor.alive === false || actor.carrier || actor.airborne ||
        (actor !== human && !actor.affection)) {
        continue;
      }
      const position = owner.targetPosition(actor);
      const radius = actor === human ? 0.4 : actor.radius;
      if (position && Math.abs(position.y - point.y) < 0.6 &&
        Math.hypot(position.x - point.x, position.z - point.z) < owner.radius + radius + 0.08) {
        return true;
      }
    }

    return false;
  }
}
