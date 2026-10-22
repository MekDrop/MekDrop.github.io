/**
 * Source-owned restraints: releasing one splat cannot remove another.
 */
export class DoorJam {
  /**
   * @type {Set<{clear: Function}>}
   */
  #sources = new Set();

  /**
   * @returns {boolean}
   */
  get active() {
    return this.#sources.size > 0;
  }

  /**
   * @param {number} openAmount
   * @param {{clear: Function}} source
   */
  attach(openAmount, source) {
    if (!source || !Number.isFinite(openAmount) || openAmount < 0 || openAmount > 0.001) {
      return false;
    }
    this.#sources.add(source);

    return true;
  }

  /**
   * @param {{clear: Function}} source
   */
  release(source) {
    return this.#sources.delete(source);
  }

  clear() {
    const sources = [...this.#sources];
    this.#sources.clear();
    for (const source of sources) {
      source.clear();
    }
  }
}
