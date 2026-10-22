/**
 * @typedef {import("../shared/Enemy.js").EnemyActor & {update?:(dt:number)=>void, setLocalTimeScale?:(source:RiftcapTimeLease,factor:number)=>void}} RiftcapTemporalActor
 */
/**
 * Reversible local clock adapter for public-update actors and Ammo projectiles.
 * Sources combine by minimum, never by multiplying overlapping bubble factors.
 * Actors with private clocks must expose setLocalTimeScale(source, factor).
 */
export class RiftcapTimeLease {
  /**
   * @type {WeakMap<object, RiftcapTimeLease>}
   */
  static #leases = new WeakMap();
  /**
   * @type {Map<object, number>}
   */
  #sources = new Map();
  /**
   * @type {number}
   */
  #factor = 1;
  /**
   * @type {import("playcanvas").Vec3|null}
   */
  #suspended = null;
  /**
   * @type {Map<import("playcanvas").AnimComponent, {base:number,applied:number}>}
   */
  #animations = new Map();

  /**
   * @param {RiftcapTemporalActor} actor
   * @param {import("./RiftcapTimeBubble.js").RiftcapTimeBubble} source
   * @param {number} factor
   */
  static acquire(actor, source, factor) {
    let lease = this.#leases.get(actor);
    if (!lease) {
      lease = new RiftcapTimeLease(actor);
      this.#leases.set(actor, lease);
    }
    lease.#sources.set(source, Math.max(0, Math.min(1, factor)));
    lease.#refresh();

    return lease;
  }

  /**
   * @param {RiftcapTemporalActor} actor
   */
  constructor(actor) {
    this.actor = actor;
    this.originalUpdate = actor.update;
    this.updateDescriptor = Object.getOwnPropertyDescriptor(actor, "update");
    if (typeof actor.setLocalTimeScale !== "function" && typeof actor.update === "function") {
      this.wrapper = this.#update.bind(this);
      actor.update = this.wrapper;
    }
  }

  /**
   * @returns {number}
   */
  get factor() {
    return this.#factor;
  }

  /**
   * @param {number} dt
   */
  #update(dt) {
    // Restore commanded velocity before actor code, then scale once afterwards.
    this.#velocity(1);
    try {
      return this.originalUpdate.call(this.actor, dt * this.#factor);
    } finally {
      this.#velocity(this.#factor);
      this.#syncAnimations();
    }
  }

  /**
   * @param {number} factor
   */
  #velocity(factor) {
    const body = this.actor.entity?.rigidbody;
    if (!body || body.enabled === false) {
      return;
    }
    if (factor === 1 && this.#factor === 0) {
      if (this.#suspended) {
        body.linearVelocity = this.#suspended.clone();
      }
      return;
    }
    if (factor === 0) {
      this.#suspended = body.linearVelocity.clone();
      body.linearVelocity = body.linearVelocity.clone().mulScalar(0);

      return;
    }
    body.linearVelocity = body.linearVelocity.clone().mulScalar(factor === 1 ? 1 / this.#factor : factor);
  }

  #refresh() {
    const next = Math.min(1, ...this.#sources.values());
    if (typeof this.actor.setLocalTimeScale === "function") {
      this.actor.setLocalTimeScale(this, next);
      this.#factor = next;

      return;
    }
    if (next === this.#factor) {
      return;
    }
    this.#velocity(1);
    this.#factor = next;
    this.#velocity(next);
    this.#syncAnimations();
  }

  #syncAnimations() {
    for (const component of this.actor.entity?.findComponents?.("anim") ?? []) {
      let record = this.#animations.get(component);
      if (!record) {
        record = {
          base: component.speed,
          applied: component.speed,
        };
        this.#animations.set(component, record);
      } else if (component.speed !== record.applied) {
        record.base = component.speed;
      }
      record.applied = record.base * this.#factor;
      component.speed = record.applied;
    }
  }

  /**
   * @param {import("./RiftcapTimeBubble.js").RiftcapTimeBubble} source
   */
  release(source) {
    this.#sources.delete(source);
    this.#refresh();
    if (this.#sources.size) {
      return;
    }
    if (this.actor.update === this.wrapper) {
      if (this.updateDescriptor) {
        Object.defineProperty(this.actor, "update", this.updateDescriptor);
      } else {
        delete this.actor.update;
      }
    }
    for (const [component, record] of this.#animations) {
      component.speed = record.base;
    }
    this.#animations.clear();
    RiftcapTimeLease.#leases.delete(this.actor);
  }
}
