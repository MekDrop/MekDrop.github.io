/**
 * One balance reaction per physical encounter, followed by yielding rather
 * than continuously driving a motorized capsule into the heavier hero.
 */
export class LatchHeroBump {
  /**
   * @type {boolean}
   */
  touching = false;
  /**
   * @type {number}
   */
  closingSpeed = 0;

  /**
   * @param {import("./LatchSlug.js").LatchSlug} owner
   */
  constructor(owner) {
    this.owner = owner;
  }

  /**
   * @param {import("playcanvas").ContactResult} result
   */
  contact(result) {
    const b = this.owner, hero = b.runtime.getHero?.();
    if (!hero?.entity || !result.other || this.touching || !b.alive || b.carrier || b.airborne
      || (result.other !== hero.entity && !result.other.isDescendantOf(hero.entity))
      || !result.contacts?.some(LatchHeroBump.#sideContact)) {
      return;
    }
    this.touching = true;
    if (this.closingSpeed >= 0.35) {
      hero.receiveSlimeBump?.(b, this.closingSpeed);
    }
  }

  /**
   * @param {import("playcanvas").ContactPoint} point
   * @returns {boolean}
   */
  static #sideContact(point) {
    // Leg contact on the hero's lower capsule is diagonally upward.
    return Math.abs(point.normal?.y ?? 1) < 0.8;
  }

  update() {
    this.closingSpeed = 0;
    const b = this.owner, hero = b.runtime.getHero?.();
    if (!hero?.entity) {
      this.touching = false;

      return;
    }
    const offset = hero.entity.getPosition().clone().sub(b.position);
    if (Math.hypot(offset.x, offset.z) > b.radius + (hero.radius ?? 0.3) + 0.25 || Math.abs(offset.y) > b.height) {
      this.touching = false;
    }
  }

  constrain() {
    this.update();
    const b = this.owner, hero = b.runtime.getHero?.(), body = b.entity.rigidbody;
    if (!hero?.entity || !body) {
      return;
    }
    const offset = hero.entity.getPosition().clone().sub(b.position);
    const distance = Math.hypot(offset.x, offset.z);
    if (distance < 0.001) {
      return;
    }
    offset.set(offset.x / distance, 0, offset.z / distance);
    const velocity = body.linearVelocity;
    this.closingSpeed = Math.max(0, velocity.dot(offset));
    if (this.touching && this.closingSpeed > 0) {
      // Keep lateral steering and gravity so the slug can go around the hero.
      body.linearVelocity = velocity.clone().sub(offset.mulScalar(this.closingSpeed));
    }
  }
}
