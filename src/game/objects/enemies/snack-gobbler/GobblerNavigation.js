/**
 * Bounded ground-plane route search against live Ammo obstacles. Steering sets
 * body velocity through Enemy; this class never integrates physical movement.
 */
export class GobblerNavigation {
  /**
   * @type {import("../shared/Enemy.js").EnemyActor|null}
   */
  #target = null;
  /**
   * @type {import("playcanvas").Vec3[]}
   */
  #route = [];
  /**
   * @type {number}
   */
  #replanAt = 0;

  /**
   * @param {import("./SnackGobbler.js").SnackGobbler} owner
   */
  constructor(owner) {
    this.owner = owner;
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} target
   * @returns {boolean}
   */
  canReach(target) {
    const goal = this.owner.targetPosition(target);
    if (!goal) {
      return false;
    }
    return !this.owner.app.systems?.rigidbody?.raycastAll || this.#clear(this.owner.position, goal, target);
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} target
   * @returns {boolean}
   */
  pursue(target) {
    const owner = this.owner;
    const goal = owner.targetPosition(target);
    if (!goal) {
      owner.stop();

      return false;
    }
    const raycast = owner.app.systems?.rigidbody?.raycastAll;
    if (!raycast || this.#clear(owner.position, goal, target)) {
      this.#route = [];

      return owner.moveToward(target, owner.movementSpeed);
    }
    if (target !== this.#target || owner.elapsed >= this.#replanAt) {
      this.#target = target;
      this.#replanAt = owner.elapsed + 1;
      this.#route = this.#findRoute(goal, target);
    }
    while (this.#route.length && owner.position.distance(this.#route[0]) < 0.25) {
      this.#route.shift();
    }
    const point = this.#route[0];
    if (!point || !this.#clear(owner.position, point, target)) {
      owner.stop();
      this.#replanAt = 0;

      return false;
    }
    return owner.moveToward({ position: point }, owner.movementSpeed);
  }

  /**
   * Sweep three rays across capsule width; no raycast result changes collision.
   * @param {import("playcanvas").Vec3} from
   * @param {import("playcanvas").Vec3} to
   * @param {import("../shared/Enemy.js").EnemyActor} target
   * @returns {boolean}
   */
  #clear(from, to, target) {
    const owner = this.owner;
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const length = Math.hypot(dx, dz) || 1;
    for (const side of [-1, 0, 1]) {
      const ox = -dz / length * owner.radius * side;
      const oz = dx / length * owner.radius * side;
      const a = new owner.pc.Vec3(from.x + ox, owner.position.y + 0.4, from.z + oz);
      const b = new owner.pc.Vec3(to.x + ox, owner.position.y + 0.4, to.z + oz);
      const hits = owner.app.systems.rigidbody.raycastAll(a, b);
      for (const hit of hits) {
        let entity = hit.entity;
        let ignored = false;
        while (entity) {
          if (entity === owner.entity || entity === target.entity || entity === target.audienceActor?.entity) {
            ignored = true;
            break;
          }
          entity = entity.parent;
        }
        if (!ignored && hit.entity?.rigidbody?.type !== "dynamic") {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * @param {import("playcanvas").Vec3} goal
   * @param {import("../shared/Enemy.js").EnemyActor} target
   * @returns {import("playcanvas").Vec3[]}
   */
  #findRoute(goal, target) {
    const owner = this.owner;
    const step = 0.8;
    const start = owner.position.clone();
    const open = [{
      x: 0,
      z: 0,
      cost: 0,
      estimate: start.distance(goal),
      point: start,
      parent: null,
    }];
    const costs = new Map([["0,0", 0]]);
    for (let iteration = 0; open.length && iteration < 700; iteration++) {
      open.sort(GobblerNavigation.#compare);
      const node = open.shift();
      if (node.point.distance(goal) < 1.2 && this.#clear(node.point, goal, target)) {
        const route = [goal.clone()];
        let parent = node;
        while (parent.parent) {
          route.unshift(parent.point);
          parent = parent.parent;
        }

        return route;
      }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = node.x + dx;
        const z = node.z + dz;
        const cost = node.cost + step;
        const key = `${x},${z}`;
        if (Math.abs(x) > 25 || Math.abs(z) > 25 || cost >= (costs.get(key) ?? Infinity)) {
          continue;
        }
        const point = new owner.pc.Vec3(start.x + x * step, start.y, start.z + z * step);
        if (!this.#clear(node.point, point, target)) {
          continue;
        }
        costs.set(key, cost);
        open.push({
          x,
          z,
          cost,
          estimate: cost + point.distance(goal),
          point,
          parent: node,
        });
      }
    }

    return [];
  }

  /**
   * @param {{estimate:number}} a
   * @param {{estimate:number}} b
   * @returns {number}
   */
  static #compare(a, b) {
    return a.estimate - b.estimate;
  }
}
