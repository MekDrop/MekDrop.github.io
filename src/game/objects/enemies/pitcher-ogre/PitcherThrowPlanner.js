/**
 * Collision-tested launch solution. Ammo, rather than a custom integrator, owns
 * the actual flight; the parabola here is only a bounded preflight query.
 */
export class PitcherThrowPlanner {
  /**
   * @param {import("./PitcherOgre.js").PitcherOgre} owner
   */
  constructor(owner) {
    this.owner = owner;
  }

  /**
   * @param {import("../shared/Enemy.js").Enemy} passenger
   * @param {import("playcanvas").Vec3} destination
   * @returns {{velocity: import("playcanvas").Vec3, landing: import("playcanvas").Vec3, duration: number}|null}
   */
  plan(passenger, destination) {
    const owner = this.owner;
    const system = owner.app.systems?.rigidbody;
    const gravity = system?.gravity?.y;
    if (!system?.raycastAll || !(gravity < 0) || !passenger?.entity?.rigidbody) {
      return null;
    }
    const origin = owner.carrySocket.getPosition().clone();
    const toward = destination.clone().sub(origin);
    toward.y = 0;
    if (toward.length() > 12 || toward.length() < 2) {
      return null;
    }
    const direction = toward.clone().normalize();
    const side = new owner.pc.Vec3(-direction.z, 0, direction.x);
    // Stop beside the royal, not inside its occupied collider. Every alternative
    // must still make progress toward that same royal actor.
    for (const offset of [0, 0.8, -0.8, 1.5, -1.5]) {
      const candidate = destination.clone().sub(direction.clone().mulScalar(1.1));
      candidate.add(side.clone().mulScalar(offset));
      const landing = this.#supportedLanding(candidate, passenger);
      if (!landing || landing.distance(destination) >= origin.distance(destination)) {
        continue;
      }
      for (const apexLift of [3, 4.5, 6]) {
        const apex = Math.max(origin.y, landing.y) + apexLift;
        const upSpeed = Math.sqrt(2 * -gravity * (apex - origin.y));
        const duration = upSpeed / -gravity + Math.sqrt(2 * (apex - landing.y) / -gravity);
        const velocity = new owner.pc.Vec3(
          (landing.x - origin.x) / duration,
          upSpeed,
          (landing.z - origin.z) / duration,
        );
        const solution = {
          velocity,
          landing,
          duration,
        };
        if (this.#clearFlight(origin, solution, passenger, gravity)) {
          return solution;
        }
      }
    }

    return null;
  }

  /**
   * @param {import("playcanvas").Vec3} point
   * @param {import("../shared/Enemy.js").Enemy} passenger
   * @returns {import("playcanvas").Vec3|null}
   */
  #supportedLanding(point, passenger) {
    const owner = this.owner;
    const Vec3 = owner.pc.Vec3;
    const radius = passenger.radius ?? 0.3;
    const height = passenger.height ?? 0.8;
    const hits = this.#hits(new Vec3(point.x, point.y + 1.5, point.z),
      new Vec3(point.x, point.y - 3, point.z), passenger);
    const floor = hits.find(PitcherThrowPlanner.#isFloor);
    if (!floor) {
      return null;
    }
    const landing = new Vec3(point.x, floor.point.y + 0.08, point.z);
    for (const [x, z] of [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius]]) {
      const base = new Vec3(landing.x + x, landing.y + 0.05, landing.z + z);
      const top = new Vec3(base.x, base.y + height, base.z);
      if (this.#hits(base, top, passenger).length) {
        return null;
      }
      const support = this.#hits(base, new Vec3(base.x, landing.y - 0.2, base.z), passenger);
      if (!support.some(PitcherThrowPlanner.#isFloor)) {
        return null;
      }
    }

    return landing;
  }

  /**
   * @param {import("playcanvas").Vec3} origin
   * @param {{velocity: import("playcanvas").Vec3, duration: number}} solution
   * @param {import("../shared/Enemy.js").Enemy} passenger
   * @param {number} gravity
   * @returns {boolean}
   */
  #clearFlight(origin, solution, passenger, gravity) {
    const Vec3 = this.owner.pc.Vec3;
    const radius = passenger.radius ?? 0.3;
    const height = passenger.height ?? 0.8;
    // Sample the capsule envelope, not merely its centre. 48 segments keeps
    // curvature error below a centimetre at the maximum supported flight time.
    const offsets = [[0, 0, 0], [radius, 0, 0], [-radius, 0, 0], [0, 0, radius], [0, 0, -radius], [0, height, 0]];
    for (const [x, y, z] of offsets) {
      let previous = origin.clone().add(new Vec3(x, y, z));
      for (let step = 1; step <= 48; step++) {
        const time = solution.duration * step / 48;
        const point = new Vec3(
          origin.x + solution.velocity.x * time + x,
          origin.y + solution.velocity.y * time + 0.5 * gravity * time * time + y,
          origin.z + solution.velocity.z * time + z,
        );
        if (this.#hits(previous, point, passenger).length) {
          return false;
        }
        previous = point;
      }
    }

    return true;
  }

  /**
   * @param {import("playcanvas").Vec3} from
   * @param {import("playcanvas").Vec3} to
   * @param {import("../shared/Enemy.js").Enemy} passenger
   * @returns {Array<import("playcanvas").RaycastResult>}
   */
  #hits(from, to, passenger) {
    return this.owner.app.systems.rigidbody.raycastAll(from, to, { sort: true })
      .filter(/**
       *
       * @param {import("playcanvas").RaycastResult} hit
       */
        (hit) => !this.#belongsTo(hit.entity, this.owner.entity) &&
        !this.#belongsTo(hit.entity, passenger.entity));
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @param {import("playcanvas").Entity} root
   * @returns {boolean}
   */
  #belongsTo(entity, root) {
    for (let current = entity; current; current = current.parent) {
      if (current === root) {
        return true;
      }
    }

    return false;
  }

  /**
   * @param {import("playcanvas").RaycastResult} hit
   * @returns {boolean}
   */
  static #isFloor(hit) {
    return hit.normal.y > 0.7 && hit.entity.rigidbody?.type === "static";
  }
}
