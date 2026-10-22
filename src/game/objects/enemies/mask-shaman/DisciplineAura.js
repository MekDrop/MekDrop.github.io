/**
 * Source-owned grudge suppression. Rivals query suppressesGrudgesFor(actor)
 * before choosing a grudge target; no grudge is erased by discipline.
 */
export class DisciplineAura {
  /**
   * @type {import("./MaskShaman.js").MaskShaman}
   */
  #owner;
  /**
   * @type {boolean}
   */
  #active = false;

  /**
   * @param {import("./MaskShaman.js").MaskShaman} owner
   */
  constructor(owner) {
    this.#owner = owner;
  }

  /**
   * @returns {boolean}
   */
  get active() {
    return this.#active && this.#owner.alive && !this.#owner.reactionReason;
  }

  /**
   * @param {boolean} value
   */
  set active(value) {
    this.#active = value;
  }

  /**
   * @param {import("../shared/Enemy.js").Enemy} actor
   * @returns {boolean}
   */
  suppressesGrudgesFor(actor) {
    return this.active && actor !== this.#owner && actor?.isEnemy === true &&
      actor.alive && !actor.airborne && !actor.carrier &&
      this.#owner.distanceTo(actor) <= this.#owner.auraRadius;
  }
}
