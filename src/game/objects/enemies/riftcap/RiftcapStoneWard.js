/**
 * A finite damage shield installed through the receiveDamage capability.
 * One active ward per recipient; refreshing does not stack damage wrappers.
 */
export class RiftcapStoneWard {
  /**
   * @type {WeakMap<object, RiftcapStoneWard>}
   */
  static #wards = new WeakMap();
  /**
   * @type {boolean}
   */
  #destroyed = false;

  /**
   * @param {import("../shared/Enemy.js").Enemy} actor
   * @param {number} duration
   * @param {number} capacity
   * @param {import("./RiftcapSpellPresentation.js").RiftcapSpellPresentation|null} presentation
   */
  constructor(actor, duration = 6, capacity = 40, presentation = null) {
    RiftcapStoneWard.#wards.get(actor)?.destroy();
    this.actor = actor;
    this.remaining = duration;
    this.capacity = capacity;
    this.presentation = presentation;
    this.original = actor.receiveDamage;
    this.descriptor = Object.getOwnPropertyDescriptor(actor, "receiveDamage");
    this.wrapper = this.#damage.bind(this);
    actor.receiveDamage = this.wrapper;
    RiftcapStoneWard.#wards.set(actor, this);
  }

  /**
   * @param {number} amount
   * @param {object|null} source
   * @param {string} kind
   */
  #damage(amount, source = null, kind = "physical") {
    if (!Number.isFinite(amount) || amount <= 0 || this.actor.alive === false) {
      return 0;
    }
    const absorbed = Math.min(amount, this.capacity);
    this.capacity -= absorbed;
    const remainder = amount - absorbed;
    if (this.capacity === 0) {
      this.destroy();
    }
    return remainder > 0 ? this.original.call(this.actor, remainder, source, kind) : 0;
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    this.remaining -= dt;
    if (this.remaining <= 0 || this.actor.alive === false) {
      this.destroy();
    } else {
      this.presentation?.update(this.actor.entity.getPosition());
    }
  }

  /**
   * @returns {boolean}
   */
  get expired() {
    return this.#destroyed;
  }

  destroy() {
    if (this.#destroyed) {
      return;
    }
    this.#destroyed = true;
    this.presentation?.destroy();
    this.presentation = null;
    if (this.actor.receiveDamage === this.wrapper) {
      if (this.descriptor) {
        Object.defineProperty(this.actor, "receiveDamage", this.descriptor);
      } else {
        delete this.actor.receiveDamage;
      }
    }
    if (RiftcapStoneWard.#wards.get(this.actor) === this) {
      RiftcapStoneWard.#wards.delete(this.actor);
    }
  }
}
