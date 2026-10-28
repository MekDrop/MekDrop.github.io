import { ENEMY_TRAVERSAL } from "../enum/EnemyTraversal.js";
import { EnemyPaths } from "./EnemyPaths.js";

/**
 * Replans against the live capability graph before a body reaches a missing
 * deck. Locomotion remains Ammo velocity/impulse driven.
 */
export class EnemyBridgeNavigation {
  /**
   * @type {import("../objects/enemies/shared/Enemy.js").Enemy}
   */
  #owner;
  /**
   * @type {{destination:import("playcanvas").Vec3, until:number, speed:number}|null}
   */
  #jump = null;
  /**
   * A chosen lower path node. Horizontal steering walks off the lip while
   * Ammo keeps sole ownership of the downward motion and eventual contact.
   * @type {import("playcanvas").Vec3|null}
   */
  #drop = null;

  /**
   * @param {import("../objects/enemies/shared/Enemy.js").Enemy} owner
   */
  constructor(owner) {
    this.#owner = owner;
  }

  /**
   * @returns {boolean}
   */
  get dropping() {
    return this.#drop !== null;
  }

  /**
   * @param {import("playcanvas").Vec3} goal
   * @param {number} speed
   * @returns {{point:import("playcanvas").Vec3|null,speed:number}}
   */
  next(goal, speed) {
    const owner = this.#owner;
    const map = owner.runtime.mapData;
    const navigation = map?.enemyNavigation;
    if (this.#drop) {
      if (owner.position.y > this.#drop.y + 0.25 || !owner.grounded) {
        return {
          point: this.#drop,
          speed,
        };
      }
      this.#drop = null;
    }
    if (!navigation?.gaps.length) {
      return {
        point: goal,
        speed,
      };
    }
    if (this.#jump && owner.elapsed < this.#jump.until) {
      return {
        point: this.#jump.destination,
        speed: this.#jump.speed,
      };
    }
    this.#jump = null;
    const capability = owner.traversalCapability;
    const gap = EnemyPaths.crossing(navigation, owner.position, goal, owner.radius, map.cols, map.rows);
    if (!gap || capability === ENEMY_TRAVERSAL.FLYING) {
      return {
        point: goal,
        speed,
      };
    }
    const approach = EnemyPaths.crossing(navigation, owner.position, owner.position,
      owner.radius + 0.1, map.cols, map.rows);
    if (capability === ENEMY_TRAVERSAL.JUMPING && !gap.overpass && approach && !owner.grounded) {
      return {
        point: null,
        speed,
      };
    }
    if (capability === ENEMY_TRAVERSAL.JUMPING && !gap.overpass && EnemyPaths.gapLength(navigation.gaps, gap) === 1 && approach &&
      owner.entity.rigidbody && owner.grounded) {
      const col = owner.position.x + (map.cols - 1) / 2;
      const row = owner.position.z + (map.rows - 1) / 2;
      const sign = Math.sign(gap.horizontal ? goal.x - owner.position.x : goal.z - owner.position.z);
      const destination = new owner.pc.Vec3(
        (gap.horizontal ? gap.col + sign * (1 + owner.radius) : col) - (map.cols - 1) / 2,
        gap.elevation,
        (gap.horizontal ? row : gap.row + sign * (1 + owner.radius)) - (map.rows - 1) / 2,
      );
      const jumpSpeed = Math.max(3.2, speed);
      const duration = Math.hypot(destination.x - owner.position.x, destination.z - owner.position.z) / jumpSpeed;
      const gravity = Math.abs(owner.app.systems?.rigidbody?.gravity?.y ?? -9.81);
      const velocity = owner.entity.rigidbody.linearVelocity;
      owner.entity.rigidbody.linearVelocity = new owner.pc.Vec3(velocity.x, gravity * duration / 2 + 0.45, velocity.z);
      owner.grounded = false;
      this.#jump = {
        destination,
        until: owner.elapsed + duration,
        speed: jumpSpeed,
      };

      return {
        point: destination,
        speed: jumpSpeed,
      };
    }
    const graph = navigation.graphs.get(capability);
    const points = navigation.points;
    let start = null;
    let end = null;
    let startDistance = Infinity;
    let endDistance = Infinity;
    for (const [key, point] of points) {
      if (!graph.get(key)?.size) {
        continue;
      }
      const world = new owner.pc.Vec3(point.col - (map.cols - 1) / 2, point.elevation, point.row - (map.rows - 1) / 2);
      const distance = Math.hypot(world.x - owner.position.x, world.z - owner.position.z);
      const crossing = EnemyPaths.crossing(navigation, owner.position, world, 0, map.cols, map.rows);
      if (Math.abs(point.elevation - owner.position.y) <= 0.9 && distance < startDistance &&
        (!crossing || crossing.overpass)) {
        start = key;
        startDistance = distance;
      }
      const remaining = Math.hypot(world.x - goal.x, world.y - goal.y, world.z - goal.z);
      if (remaining < endDistance) {
        end = key;
        endDistance = remaining;
      }
    }
    if (!start || !end) {
      return {
        point: null,
        speed,
      };
    }
    const parents = new Map([[start, null]]);
    const pending = [start];
    let closest = start;
    let closestDistance = Infinity;
    for (let index = 0; index < pending.length; index++) {
      const key = pending[index];
      const point = points.get(key);
      const distance = Math.hypot(point.col - (map.cols - 1) / 2 - goal.x,
        point.elevation - goal.y, point.row - (map.rows - 1) / 2 - goal.z);
      if (distance < closestDistance) {
        closest = key;
        closestDistance = distance;
      }
      if (key === end) {
        closest = key;
        break;
      }
      for (const neighbor of graph.get(key)) {
        if (!parents.has(neighbor)) {
          parents.set(neighbor, key);
          pending.push(neighbor);
        }
      }
    }
    const route = [closest];
    while (parents.get(route[0])) {
      route.unshift(parents.get(route[0]));
    }
    // Stand one body radius behind the exposed lip rather than balancing the
    // root on the last graph node, which lies exactly on the tile boundary.
    for (let index = 0; index < route.length; index++) {
      const key = route[index];
      const point = points.get(key);
      const world = new owner.pc.Vec3(point.col - (map.cols - 1) / 2, point.elevation, point.row - (map.rows - 1) / 2);
      const next = route[index + 1];
      if (navigation.drops?.get(key)?.has(next) &&
        Math.hypot(world.x - owner.position.x, world.z - owner.position.z) <= owner.radius + 0.4) {
        const destination = points.get(next);
        this.#drop = new owner.pc.Vec3(destination.col - (map.cols - 1) / 2,
          destination.elevation, destination.row - (map.rows - 1) / 2);
        owner.grounded = false;

        return {
          point: this.#drop,
          speed,
        };
      }
      if (Math.hypot(world.x - owner.position.x, world.z - owner.position.z) < 0.3) {
        continue;
      }
      const unsafe = EnemyPaths.crossing(navigation, owner.position, world, owner.radius + 0.08, map.cols, map.rows);
      if (unsafe && (capability === ENEMY_TRAVERSAL.WALKING || EnemyPaths.gapLength(navigation.gaps, unsafe) > 1)) {
        return {
          point: null,
          speed,
        };
      }

      return {
        point: world,
        speed,
      };
    }

    return {
      point: null,
      speed,
    };
  }
}
