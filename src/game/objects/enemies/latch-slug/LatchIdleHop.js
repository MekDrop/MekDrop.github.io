import { LatchSeekState } from "./states/LatchSeekState.js";
import { LatchDogState } from "./states/LatchDogState.js";

/**
 * Random, position-based idle hops, including a companion wait or blocked crawl.
 */
export class LatchIdleHop {
  /**
   * @type {import("./LatchSlug.js").LatchSlug}
   */
  #owner;
  /**
   * @type {()=>number}
   */
  #random;
  /**
   * @type {import("playcanvas").Vec3}
   */
  #anchor;
  /**
   * @type {number|null}
   */
  #remaining = null;

  /**
   * @param {import("./LatchSlug.js").LatchSlug} owner
   * @param {()=>number} random
   */
  constructor(owner, random = Math.random) {
    this.#owner = owner;
    this.#random = random;
    this.#anchor = owner.position.clone();
  }

  /**
   * @returns {boolean}
   */
  get eligible() {
    const owner = this.#owner;

    return owner.alive && owner.grounded && !owner.airborne && !owner.carrier && !owner.gatewayArrival.active
      && !owner.stairCrawl?.active && !owner.statuses.has("stun") && !owner.statuses.has("confused")
      && !(owner.affection?.patRemaining > 0)
      && [LatchSeekState.name, LatchDogState.name].includes(owner.stateName);
  }

  /**
   * @returns {number}
   */
  get lift() {
    return Math.sqrt(2 * this.#gravity * 0.5);
  }

  /**
   * @returns {number}
   */
  get flightDuration() {
    return 2 * this.lift / this.#gravity;
  }

  /**
   * @returns {number}
   */
  get #gravity() {
    return Math.max(0.1, Math.abs(this.#owner.app?.systems?.rigidbody?.gravity?.y ?? -9.81));
  }

  /**
   * @returns {boolean}
   */
  get clearance() {
    const owner = this.#owner, physics = owner.app?.systems?.rigidbody;
    if (!physics?.raycastFirst) {
      return false;
    }
    if (this.#nearbyBody()) {
      return false;
    }
    const from = owner.position.clone(), to = owner.position.clone();
    from.y += 0.12;
    to.y -= 0.18;
    const options = { filterCallback: this.#otherCollider.bind(this) };
    const ground = physics.raycastFirst(from, to, options);
    if (!ground || Math.abs(ground.normal.y) < 0.5) {
      return false;
    }
    const radius = owner.radius * 0.8;
    for (const [x, z] of [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius]]) {
      from.copy(owner.position);
      from.x += x;
      from.z += z;
      from.y += owner.height - 0.05;
      to.copy(from);
      to.y = owner.position.y + owner.height + 0.6;
      if (physics.raycastFirst(from, to, options)) {
        return false;
      }
    }

    return true;
  }

  /**
   * A clear ceiling alone does not make a social hop safe. Reserve the full
   * neighbouring footprint so the airborne slug cannot land through a bug.
   * @returns {boolean}
   */
  #nearbyBody() {
    const owner = this.#owner;
    for (const actor of owner.actors ?? []) {
      if (actor === owner || actor.alive === false || actor.carrier ||
        !actor.entity?.rigidbody || actor.entity.rigidbody.enabled === false || actor.entity.rigidbody.type === "static") {
        continue;
      }
      const point = owner.targetPosition?.(actor) ?? actor.position ?? actor.entity.getPosition();
      if (point.y > owner.position.y + owner.height + 0.5 ||
        point.y + (actor.height ?? 0.8) < owner.position.y - 0.05) {
        continue;
      }
      const clearance = owner.radius + (actor.footprintRadius ?? actor.radius ?? 0.3) + 0.08;
      if (Math.hypot(point.x - owner.position.x, point.z - owner.position.z) < clearance) {
        return true;
      }
    }

    return false;
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @returns {boolean}
   */
  #otherCollider(entity) {
    return entity !== this.#owner.entity && !entity.isDescendantOf(this.#owner.entity);
  }

  reset() {
    this.#anchor.copy(this.#owner.position);
    this.#remaining = null;
  }

  /**
   * @param {number} dt
   * @returns {boolean}
   */
  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) {
      return false;
    }
    if (!this.eligible || this.#owner.position.distance(this.#anchor) > 0.12) {
      this.reset();

      return false;
    }
    this.#remaining ??= 4 + this.#random() * 5;
    this.#remaining -= dt;
    if (this.#remaining > 0) {
      return false;
    }
    this.reset();

    return this.#owner.beginIdleHop();
  }
}
