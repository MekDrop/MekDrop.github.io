/**
 * Runs scene decoration in small chunks while the loading screen stays visible.
 * Clearing the scene invalidates both scheduled callbacks and suspended work.
 */
export class SceneDecorationQueue {
  /**
   * @type {Array<() => void|Iterator<void>>}
   */
  #jobs = [];
  /**
   * @type {number}
   */
  #generation = 0;
  /**
   * @type {boolean}
   */
  #started = false;
  /**
   * @type {boolean}
   */
  #scheduled = false;
  /**
   * @type {Iterator<void>|null}
   */
  #active = null;
  /**
   * @type {(error: Error) => void}
   */
  #onError;
  /**
   * @type {Array<(completed: boolean) => void>}
   */
  #waiters = [];

  /**
   * @param {(error: Error) => void} onError
   */
  constructor(onError) {
    this.#onError = onError;
  }

  /**
   * @param {() => void|Iterator<void>} job
   */
  add(job) {
    this.#jobs.push(job);
    if (this.#started && !this.#scheduled) {
      this.#schedule(this.#generation);
    }
  }

  /**
   * Resolves false when loading is superseded or the scene is cleared.
   * @returns {Promise<boolean>}
   */
  start() {
    const completion = !this.#active && !this.#jobs.length
      ? Promise.resolve(true)
      : new Promise(/**
       * @param {(completed: boolean) => void} resolve
       */
        (resolve) => this.#waiters.push(resolve));
    if (!this.#started) {
      this.#started = true;
      this.#schedule(this.#generation);
    }
    return completion;
  }

  clear() {
    this.pause();
    this.#jobs = [];
    this.#active = null;
  }

  pause() {
    this.#generation += 1;
    this.#started = false;
    this.#scheduled = false;
    this.#settle(false);
  }

  /**
   * @param {boolean} completed
   */
  #settle(completed) {
    for (const resolve of this.#waiters.splice(0)) {
      resolve(completed);
    }
  }

  /**
   * @param {number} generation
   */
  #schedule(generation) {
    this.#scheduled = true;
    // Let the loading screen paint between chunks instead of blocking a frame.
    // Embedded/background browsers may suspend animation frames entirely. Loading
    // must still settle; whichever callback wins owns this chunk exactly once.
    let pending = true;
    const run = () => {
      if (!pending) {
        return;
      }
      pending = false;
      clearTimeout(fallback);
      this.#run(generation);
    };
    const fallback = setTimeout(run, 100);
    requestAnimationFrame(() => setTimeout(run, 0));
  }

  /**
   * @param {number} generation
   */
  #run(generation) {
    if (generation !== this.#generation || !this.#started) {
      return;
    }
    try {
      const deadline = performance.now() + 4;
      do {
        if (!this.#active) {
          this.#active = this.#jobs.shift()?.() ?? null;
        }
        if (this.#active?.next().done) {
          this.#active = null;
        }
      } while ((this.#active || this.#jobs.length) && performance.now() < deadline);
    } catch (error) {
      this.#active = null;
      this.#onError(error);
    }
    if (generation === this.#generation) {
      this.#scheduled = false;
      if (this.#active || this.#jobs.length) {
        this.#schedule(generation);
      } else {
        this.#settle(true);
      }
    }
  }
}
