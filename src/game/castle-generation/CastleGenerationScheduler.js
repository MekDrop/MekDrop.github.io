import { CastleGenerationAbortedError } from "../errors/castle/index.js";

export class CastleGenerationScheduler {
  #signal;
  #frameBudgetMs;

  constructor({ signal = null, frameBudgetMs = 8 } = {}) {
    this.#signal = signal;
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
    await new Promise((resolve) => {
      if (typeof globalThis.requestAnimationFrame === "function") {
        globalThis.requestAnimationFrame(() => resolve());
        return;
      }
      globalThis.setTimeout(resolve, 0);
    });
    this.throwIfAborted();
  }
}
