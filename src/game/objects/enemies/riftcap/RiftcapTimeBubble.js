import { RiftcapTimeLease } from "./RiftcapTimeLease.js";
import { RiftcapSpellPresentation } from "./RiftcapSpellPresentation.js";

/**
 * Map-local area effect. No app timeScale changes and no projectile deletion.
 * The owner supplies actor/projectile capabilities, including both factions.
 */
export class RiftcapTimeBubble {
  /**
   * @type {Map<object, RiftcapTimeLease>}
   */
  #affected = new Map();
  /**
   * @type {boolean}
   */
  #destroyed = false;

  /**
   * @param {import("./Riftcap.js").Riftcap} owner
   * @param {{radius?:number, duration?:number, factor?:number}} options
   */
  constructor(owner, { radius = 3.5, duration = 5, factor = 0.3 } = {}) {
    this.owner = owner;
    this.center = owner.position.clone();
    this.radius = radius;
    this.remaining = duration;
    this.factor = Math.max(0, Math.min(1, factor));
    this.unsupportedActors = new Set();
    this.presentation = owner.app.graphicsDevice ? new RiftcapSpellPresentation(owner, "time bubble", this.center, radius) : null;
  }

  /**
   * @returns {boolean}
   */
  get expired() {
    return this.#destroyed;
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    if (this.#destroyed) {
      return;
    }
    this.remaining -= dt;
    if (!this.owner.alive || this.remaining <= 0 || this.owner.statuses.has("confused") || this.owner.statuses.has("stun")) {
      this.destroy();

      return;
    }
    const present = new Set();
    this.unsupportedActors.clear();
    for (const actor of this.owner.temporalActors) {
      const position = actor.entity?.getPosition?.() ?? actor.position;
      if (actor === this.owner || actor.alive === false || !position || position.distance(this.center) > this.radius) {
        continue;
      }
      // Do not claim a complete slow when only velocity/pose can be changed.
      // Private-clock actors need the explicit capability in their own owner.
      if (typeof actor.update !== "function" && typeof actor.setLocalTimeScale !== "function") {
        this.unsupportedActors.add(actor);
        continue;
      }
      present.add(actor);
      if (!this.#affected.has(actor)) {
        this.#affected.set(actor, RiftcapTimeLease.acquire(actor, this, this.factor));
      }
    }
    for (const [actor, lease] of this.#affected) {
      if (!present.has(actor)) {
        lease.release(this);
        this.#affected.delete(actor);
      }
    }
  }

  destroy() {
    if (this.#destroyed) {
      return;
    }
    this.#destroyed = true;
    for (const lease of this.#affected.values()) {
      lease.release(this);
    }
    this.#affected.clear();
    this.unsupportedActors.clear();
    this.presentation?.destroy();
  }
}
