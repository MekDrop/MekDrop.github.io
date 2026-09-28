const DEFAULT_COOLDOWN_MILLISECONDS = 400;

export class InteractionSuggestion {
  /**
   *
   * @type {(value: boolean|number|string|null) => void}
   */
  #onChange;
  /**
   *
   * @type {Array}
   */
  #cooldownMilliseconds;
  /**
   *
   * @type {number}
   */
  #lastChangeAt = Number.NEGATIVE_INFINITY;
  /**
   *
   * @type {null}
   */
  #pendingTarget = null;
  /**
   *
   * @type {boolean}
   */
  #hasPendingTarget = false;
  /**
   *
   * @type {null}
   */
  #timeoutId = null;

  /**
   *
   * @param {(value: boolean|number|(value: boolean|number|string|null) => void|null) => void} onChange
   * @param {number} cooldownMilliseconds
   */
  constructor(onChange, cooldownMilliseconds = DEFAULT_COOLDOWN_MILLISECONDS) {
    /**
     *
     * @type {(value: boolean|number|string|null) => void}
     */
    this.#onChange = onChange;
    /**
     *
     * @type {Array}
     */
    this.#cooldownMilliseconds = cooldownMilliseconds;
  }

  /**
   *
   * @param {EventTarget|pc.Entity} target
   */
  update(target) {
    this.#pendingTarget = target;
    this.#hasPendingTarget = true;

    const remainingMilliseconds = Math.max(
      0,
      this.#cooldownMilliseconds - (performance.now() - this.#lastChangeAt),
    );
    if (remainingMilliseconds === 0) {
      this.#applyPendingTarget();
      return;
    }
    if (this.#timeoutId !== null) {
      return;
    }

    this.#timeoutId = window.setTimeout(
      () => this.#applyPendingTarget(),
      remainingMilliseconds,
    );
  }

  clear() {
    this.#cancelPendingUpdate();
    this.#lastChangeAt = performance.now();
    this.#onChange(null);
  }

  destroy() {
    this.#cancelPendingUpdate();
  }

  #applyPendingTarget() {
    this.#timeoutId = null;
    if (!this.#hasPendingTarget) {
      return;
    }

    const target = this.#pendingTarget;
    this.#pendingTarget = null;
    this.#hasPendingTarget = false;
    this.#lastChangeAt = performance.now();
    this.#onChange(target);
  }

  #cancelPendingUpdate() {
    if (this.#timeoutId !== null) {
      window.clearTimeout(this.#timeoutId);
      this.#timeoutId = null;
    }
    this.#pendingTarget = null;
    this.#hasPendingTarget = false;
  }
}
