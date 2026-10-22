/**
 * Independent, bounded restraint lifetime. No damage and no living collider.
 */
export class LatchGlue {
  /**
   * @type {import("../../architecture/door/Door.js").Door|null}
   */
  #door;
  /**
   * @type {number}
   */
  #remaining;

  /**
   * @param {import("../../architecture/door/Door.js").Door|null} door
   * @param {number} duration
   */
  constructor(door, duration = 20) {
    this.#door = door;
    this.#remaining = Number.isFinite(duration) ? Math.max(0, Math.min(30, duration)) : 20;
    if (!this.active) {
      this.#door = null;

      return;
    }
    if (door && !door.jamShut(this)) {
      this.#remaining = 0;
    }
  }

  /**
   * @returns {boolean}
   */
  get active() {
    return this.#remaining > 0;
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) {
      return;
    }
    this.#remaining = Math.max(0, this.#remaining - dt);
    if (!this.active || (this.#door && !this.#door.jammed)) {
      this.clear();
    }
  }

  clear() {
    this.#remaining = 0;
    this.#door?.releaseJam(this);
    this.#door = null;
  }
}
