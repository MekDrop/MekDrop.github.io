/**
 * Timed movement/action effects shared by friendly map actors.
 */
export class ActorStatusEffects {
  /**
   * @type {Map<string, {remaining: number, rate: number}>}
   */
  #effects = new Map();

  /**
   * @param {string} name
   * @param {{duration: number, factor?: number}} options
   * @returns {boolean}
   */
  apply(name, { duration, factor = 1 } = {}) {
    if (!["slow", "stun"].includes(name) || !Number.isFinite(duration) || duration <= 0 ||
      !Number.isFinite(factor) || factor < 0 || factor > 1) {
      return false;
    }
    const rate = name === "stun" ? 0 : factor;
    const key = `${name}:${rate}`;
    this.#effects.set(key, {
      remaining: Math.max(duration, this.#effects.get(key)?.remaining ?? 0),
      rate,
    });

    return true;
  }

  /**
   * @returns {number}
   */
  get rate() {
    return Math.min(1, ...Array.from(this.#effects.values(), /**
     *
     * @param {{remaining: number, rate: number}} effect
     * @returns {number}
     */
      (effect) => effect.rate));
  }

  /**
   * Status clocks use elapsed game time, even while actions are frozen.
   * @param {number} deltaTime
   */
  advance(deltaTime) {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) {
      return;
    }
    for (const [key, effect] of this.#effects) {
      effect.remaining -= deltaTime;
      if (effect.remaining <= 0) {
        this.#effects.delete(key);
      }
    }
  }
}
