import { CastleGenerationAbortedError } from "../../errors/castle/index.js";

export class CastleGenerationScheduler {
  /**
   *
   * @type {AbortSignal|null}
   */
  #signal;
  /**
   *
   * @type {Array}
   */
  #frameBudgetMs;

  /**
   *
   * @param {{signal: AbortSignal, frameBudgetMs: number}} options
   * @param {AbortSignal} options.signal
   * @param {number} options.frameBudgetMs
   */
  constructor({ signal = null, frameBudgetMs = 8 } = {}) {
    /**
     *
     * @type {AbortSignal|null}
     */
    this.#signal = signal;
    /**
     *
     * @type {Array}
     */
    this.#frameBudgetMs = frameBudgetMs;
  }

  now() {
    return globalThis.performance?.now?.() ?? Date.now();
  }

  throwIfAborted() {
    if (this.#signal?.aborted) {
      throw new CastleGenerationAbortedError();
    }
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").StoreContract} state
   */
  async yieldIfNeeded(state) {
    this.throwIfAborted();
    if (this.now() - state.lastYield < this.#frameBudgetMs) {
      return;
    }
    await this.yieldToMainThread();
    state.lastYield = this.now();
  }

  async yieldToMainThread() {
    this.throwIfAborted();
    await new Promise(/**
     *
     * @param {(value?: (value?: void) => void) => void} resolve
     */
    (resolve) => {
      if (typeof globalThis.requestAnimationFrame === "function") {
        globalThis.requestAnimationFrame(() => resolve());
        return;
      }
      globalThis.setTimeout(resolve, 0);
    });
    this.throwIfAborted();
  }
}
