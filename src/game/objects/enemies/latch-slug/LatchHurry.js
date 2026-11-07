import { LatchAnnoyedState } from "./states/LatchAnnoyedState.js";

/**
 * Annoyance prompts a stamina-limited effort along the slime's normal route.
 */
export class LatchHurry {
  /**
   * Seconds of boosted movement remaining; a full refill takes five seconds.
   * @type {number}
   */
  stamina = 2;
  /**
   * @type {boolean}
   */
  active = false;
  /**
   * @type {boolean}
   */
  exhausted = false;
  /**
   * @type {import("./LatchSlug.js").LatchSlug}
   */
  #owner;

  /**
   * @param {import("./LatchSlug.js").LatchSlug} owner
   */
  constructor(owner) {
    this.#owner = owner;
  }

  /**
   * @returns {number}
   */
  get speedFactor() {
    return this.active ? 1.8 : 1;
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) {
      return;
    }
    const owner = this.#owner;
    const velocity = owner.entity.rigidbody?.linearVelocity;
    const moving = velocity && Math.hypot(velocity.x, velocity.z) > 0.04;
    const eligible = owner.alive && !owner.carrier && !owner.airborne && !owner.gatewayArrival.active
      && !owner.stairCrawl?.active && !owner.statuses.has("stun") && !owner.statuses.has("confused")
      && owner.stateName === LatchAnnoyedState.name;
    this.active = !!(eligible && moving && !this.exhausted && owner.annoyance?.active);
    if (this.active) {
      this.stamina = Math.max(0, this.stamina - dt);
      if (this.stamina === 0) {
        this.exhausted = true;
        this.active = false;
      }
    } else {
      this.stamina = Math.min(2, this.stamina + dt * 0.4);
      if (this.stamina === 2) {
        this.exhausted = false;
      }
    }
  }
}
