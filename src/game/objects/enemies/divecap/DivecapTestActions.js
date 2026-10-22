/**
 * Saved-map demonstrations using real actors, bodies, floor queries and hooks.
 */
export class DivecapTestActions {
  /**
   * @param {import("./Divecap.js").Divecap} owner
   */
  constructor(owner) {
    this.owner = owner;
  }

  /**
   * @returns {import("../shared/Enemy.js").Enemy|null}
   */
  resetPitcher() {
    const pitcher = this.owner.nearestPitcher;
    if (!pitcher?.entity.rigidbody) {
      return null;
    }
    const point = pitcher.definition.position;
    if (point) {
      pitcher.entity.rigidbody.teleport(new this.owner.pc.Vec3(point.x, point.y ?? 0, point.z));
    }
    pitcher.testPlayClip?.("idle");

    return pitcher;
  }

  /**
   * @returns {boolean}
   */
  queue() {
    const pitcher = this.resetPitcher();
    if (!pitcher) {
      return false;
    }
    this.owner.testPlayClip(null);
    pitcher.testPlayClip?.(null);
    this.owner.onBellRung({
      eventId: `divecap-demo-${this.owner.elapsed}`,
      source: pitcher,
    });

    return true;
  }

  /**
   * @returns {import("../shared/Enemy.js").Enemy|null}
   */
  carry() {
    const owner = this.owner;
    if (owner.carrier) {
      return owner.carrier;
    }
    const pitcher = this.resetPitcher();
    if (!pitcher || !owner.alive || owner.airborne) {
      return null;
    }
    owner.testPlayClip(null);
    owner.entity.rigidbody.teleport(pitcher.position.clone().add(pitcher.entity.right.clone().mulScalar(1.1)));

    return pitcher.pickUp(owner) ? pitcher : null;
  }

  /**
   * @returns {boolean}
   */
  throwTowardRoyal() {
    const owner = this.owner;
    const pitcher = owner.carrier ?? this.carry();
    const royal = owner.resolveRoyalTarget();
    if (!pitcher || !royal) {
      return false;
    }
    const solution = pitcher.throwPlanner?.plan(owner, owner.targetPosition(royal));

    return solution ? pitcher.releasePassenger(solution.velocity) : false;
  }

  /**
   * A short vertical throw beside the actual royal verifies successful splash.
   * @returns {boolean}
   */
  dropNearRoyal() {
    const owner = this.owner;
    const royal = owner.resolveRoyalTarget();
    if (!royal || !owner.alive || owner.airborne || owner.carrier || !owner.entity.rigidbody) {
      return false;
    }
    const point = owner.targetPosition(royal);
    for (const [dx, dz] of [[0, -0.9], [0, 0.9], [-0.9, 0], [0.9, 0], [-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) {
      const x = point.x + dx;
      const z = point.z + dz;
      const floor = this.#floorAt(x, z, point.y);
      if (floor === null || owner.runtime.collisionWorld.isBlocked(x, z, owner.radius, floor, 0.12)) {
        continue;
      }
      const origin = new owner.pc.Vec3(x, floor + 0.55, z);
      const target = point.clone();
      target.y += 0.65;
      if (!this.#visible(origin, target, royal)) {
        continue;
      }
      owner.testPlayClip(null);
      owner.entity.rigidbody.teleport(new owner.pc.Vec3(x, floor + 0.15, z));

      return owner.launch({ velocity: new owner.pc.Vec3(0, 2, 0) });
    }

    return false;
  }

  /**
   * @param {number} x
   * @param {number} z
   * @param {number} y
   * @returns {number|null}
   */
  #floorAt(x, z, y) {
    const owner = this.owner;
    const from = new owner.pc.Vec3(x, y + 0.1, z);
    const to = new owner.pc.Vec3(x, y - 5, z);
    let floor = null;
    for (const hit of owner.app.systems.rigidbody.raycastAll(from, to)) {
      if (hit.normal.y > 0.5 && (floor === null || hit.point.y > floor)) {
        floor = hit.point.y;
      }
    }

    return floor;
  }

  /**
   * @param {import("playcanvas").Vec3} from
   * @param {import("playcanvas").Vec3} to
   * @param {import("../shared/Enemy.js").EnemyActor} royal
   * @returns {boolean}
   */
  #visible(from, to, royal) {
    for (const hit of this.owner.app.systems.rigidbody.raycastAll(from, to)) {
      if (hit.entity !== royal.entity && !hit.entity.isDescendantOf(royal.entity)) {
        return false;
      }
    }

    return true;
  }
}
