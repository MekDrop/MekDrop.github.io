import { Vec3 } from "playcanvas";

/**
 * Physics-backed hook contact. Reservations are scoped to the actual collider,
 * and discarded on release; destroyed maps cannot leave global occupied slots.
 */
export class HookClimbGrip {
  /**
   * @type {WeakMap<import("playcanvas").Entity, Set<HookClimbGrip>>}
   */
  static #claims = new WeakMap();
  /**
   * @type {import("../shared/Enemy.js").Enemy}
   */
  #owner;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #surface = null;
  /**
   * @type {Vec3|null}
   */
  #normal = null;
  /**
   * @type {Vec3|null}
   */
  #savedFactor = null;

  /**
   * @param {import("../shared/Enemy.js").Enemy} owner
   */
  constructor(owner) {
    this.#owner = owner;
  }

  /**
   * @returns {boolean}
   */
  get attached() {
    return this.#surface !== null;
  }

  /**
   * @returns {Vec3|null}
   */
  get inward() {
    return this.#normal?.clone().mulScalar(-1) ?? null;
  }

  /**
   * Find a close vertical, static collider toward the royal. Dynamic actors and
   * ground contacts cannot become hooks. No authored coordinates count as contact.
   * @param {Vec3} direction
   * @returns {import("playcanvas").RaycastResult|null}
   */
  probe(direction) {
    const start = this.#owner.position.clone().add(new Vec3(0, this.#owner.height * 0.65, 0));
    const reach = direction.clone();
    reach.y = 0;
    if (reach.lengthSq() < 0.0001) {
      return null;
    }
    const end = start.clone().add(reach.normalize().mulScalar(this.#owner.radius + 0.32));
    const hit = this.#owner.app.systems.rigidbody.raycastFirst(start, end, {
      filterCallback: HookClimbGrip.#staticCollider,
    });

    return hit && Math.abs(hit.normal.y) < 0.2 ? hit : null;
  }

  /**
   * Competing gremlins reserve their body-height patch, rather than an entire
   * wall. Ammo remains responsible for body motion and collision response.
   * @param {import("playcanvas").RaycastResult} hit
   * @returns {boolean}
   */
  attach(hit) {
    if (!this.#owner.alive || this.#owner.carrier || !hit ||
      Math.abs(hit.normal.y) >= 0.2 || !HookClimbGrip.#staticCollider(hit.entity)) {
      return false;
    }
    const body = this.#owner.entity.rigidbody;
    if (!body?.enabled || hit.point.distance(this.#owner.position) > this.#owner.height + 0.65) {
      return false;
    }
    const claims = HookClimbGrip.#claims.get(hit.entity) ?? new Set();
    for (const claim of claims) {
      if (claim !== this && claim.#owner.alive &&
        claim.#owner.position.distance(this.#owner.position) < this.#owner.height * 1.1) {
        return false;
      }
    }
    this.release();
    this.#surface = hit.entity;
    this.#normal = hit.normal.clone();
    this.#savedFactor = body.linearFactor.clone();
    claims.add(this);
    HookClimbGrip.#claims.set(hit.entity, claims);
    body.linearVelocity = new Vec3();
    body.linearFactor = new Vec3(0, 0, 0);

    return true;
  }

  /**
   * Confirm the collider still exists at hook reach. A disappearing wall or
   * displaced actor immediately releases the constraint, including during bells.
   * @returns {boolean}
   */
  validate() {
    if (!this.#surface || !this.#owner.alive || !this.#surface.enabled) {
      this.release();

      return false;
    }
    const hit = this.probe(this.#normal.clone().mulScalar(-1));
    if (hit?.entity !== this.#surface) {
      this.release();

      return false;
    }
    return true;
  }

  /**
   * Lock horizontal motion while climbing; cancel engine gravity with a force.
   * A zero speed locks all axes for clinging/confusion without integrating motion.
   * @param {number} speed
   * @returns {boolean}
   */
  climb(speed) {
    if (!Number.isFinite(speed) || !this.validate()) {
      return false;
    }
    const body = this.#owner.entity.rigidbody;
    body.linearFactor = new Vec3(0, speed === 0 ? 0 : 1, 0);
    body.linearVelocity = new Vec3(0, speed, 0);
    if (speed !== 0) {
      body.applyForce(this.#owner.app.systems.rigidbody.gravity.clone().mulScalar(-body.mass));
    }
    return true;
  }

  release() {
    if (!this.#surface) {
      return;
    }
    HookClimbGrip.#claims.get(this.#surface)?.delete(this);
    const body = this.#owner.entity.rigidbody;
    if (body && this.#savedFactor) {
      body.linearFactor = this.#savedFactor;
      body.linearVelocity = new Vec3();
    }
    this.#surface = null;
    this.#normal = null;
    this.#savedFactor = null;
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @returns {boolean}
   */
  static #staticCollider(entity) {
    return entity.enabled && entity.rigidbody?.type === "static";
  }
}
