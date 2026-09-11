const DEFAULT_COOLDOWN_MILLISECONDS = 400;

export class InteractionSuggestion {
  #onChange;
  #cooldownMilliseconds;
  #lastChangeAt = Number.NEGATIVE_INFINITY;
  #pendingTarget = null;
  #hasPendingTarget = false;
  #timeoutId = null;

  constructor(onChange, cooldownMilliseconds = DEFAULT_COOLDOWN_MILLISECONDS) {
    this.#onChange = onChange;
    this.#cooldownMilliseconds = cooldownMilliseconds;
  }

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
