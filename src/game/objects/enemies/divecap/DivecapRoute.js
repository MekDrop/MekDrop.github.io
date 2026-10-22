/**
 * Bounded ground navigation; Ammo remains responsible for movement/contact.
 */
export class DivecapRoute {
  /**
   * @param {import("./Divecap.js").Divecap} owner
   */
  constructor(owner) {
    this.owner = owner;
    this.path = [];
    this.refreshAt = 0;
  }

  /**
   * @param {import("playcanvas").Vec3} target
   * @returns {import("playcanvas").Vec3|null}
   */
  next(target) {
    const owner = this.owner;
    if (owner.elapsed >= this.refreshAt) {
      this.refreshAt = owner.elapsed + 0.7;
      this.path = this.#find(target);
    }
    while (this.path.length && owner.position.distance(this.path[0]) < 0.24) {
      this.path.shift();
    }

    return this.path[0] ?? null;
  }

  /**
   * @param {import("playcanvas").Vec3} target
   * @returns {import("playcanvas").Vec3[]}
   */
  #find(target) {
    const owner = this.owner;
    const world = owner.runtime.collisionWorld;
    if (!world) {
      return [target.clone()];
    }
    const step = 0.5;
    const origin = owner.position;
    const start = [Math.round(origin.x / step), Math.round(origin.z / step)];
    const end = [Math.round(target.x / step), Math.round(target.z / step)];
    /**
     * @param {number} x
     * @param {number} z
     */
    const key = (x, z) => `${x},${z}`;
    const startKey = key(...start);
    const pending = [{
      x: start[0],
      z: start[1],
      cost: 0,
      score: 0,
      parent: null,
    }];
    const visited = new Set([startKey]);
    for (let i = 0; pending.length && i < 2500; i++) {
      pending.sort(DivecapRoute.#compare);
      const node = pending.shift();
      if (Math.hypot(node.x - end[0], node.z - end[1]) <= 1) {
        const path = [target.clone()];
        for (let cursor = node; cursor.parent; cursor = cursor.parent) {
          path.unshift(new owner.pc.Vec3(cursor.x * step, origin.y, cursor.z * step));
        }

        return path;
      }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = node.x + dx;
        const z = node.z + dz;
        const id = key(x, z);
        if (visited.has(id) || Math.hypot(x - start[0], z - start[1]) > 48) {
          continue;
        }
        visited.add(id);
        if (world.isMovementBlocked(node.x * step, node.z * step, x * step, z * step, owner.radius, origin.y, 0.12)) {
          continue;
        }
        const height = this.#surfaceAt(x * step, z * step, origin.y);
        if (height === null || (Number.isFinite(height) && Math.abs(height - origin.y) > 0.2)) {
          continue;
        }
        const cost = node.cost + 1;
        pending.push({
          x,
          z,
          cost,
          score: cost + Math.abs(x - end[0]) + Math.abs(z - end[1]),
          parent: node,
        });
      }
    }

    return [];
  }

  /**
   * Outdoor terrain is an Ammo surface, not always a collision-world provider.
   * @param {number} x
   * @param {number} z
   * @param {number} y
   * @returns {number|null}
   */
  #surfaceAt(x, z, y) {
    const owner = this.owner;
    const authored = owner.runtime.collisionWorld.physicsSurfaceHeightAt(x, z, owner.radius);
    if (Number.isFinite(authored)) {
      return authored;
    }
    const from = new owner.pc.Vec3(x, y + 0.3, z);
    const to = new owner.pc.Vec3(x, y - 0.3, z);
    let height = null;
    for (const hit of owner.app.systems.rigidbody.raycastAll(from, to)) {
      if (hit.normal.y > 0.5 && hit.entity.rigidbody?.type !== "dynamic" && (height === null || hit.point.y > height)) {
        height = hit.point.y;
      }
    }

    return height;
  }

  /**
   * @param {{score:number}} a
   * @param {{score:number}} b
   * @returns {number}
   */
  static #compare(a, b) {
    return a.score - b.score;
  }
}
