/**
 * Suspends engine frames while loading, including object callbacks and physics.
 */
export class GameFrameLoop {
  /**
   * @type {import("playcanvas").Application}
   */
  #app;
  /**
   * @type {boolean}
   */
  #paused = false;
  /**
   * @type {number|null}
   */
  #resumeTimeScale = null;

  /**
   * @param {import("playcanvas").Application} app
   */
  constructor(app) {
    this.#app = app;
  }

  pause() {
    if (this.#paused) {
      return;
    }
    this.#paused = true;
    if (this.#app.frameRequestId != null) {
      cancelAnimationFrame(this.#app.frameRequestId);
      this.#app.frameRequestId = null;
    }
    this.#app.off("frameend", this.#restoreTimeScale, this);
    this.#restoreTimeScale();
  }

  resume() {
    if (!this.#paused) {
      return;
    }
    this.#paused = false;
    // Let the engine refresh its timestamp without advancing past loading time.
    this.#resumeTimeScale = this.#app.timeScale;
    this.#app.timeScale = 0;
    this.#app.once("frameend", this.#restoreTimeScale, this);
    this.#app.requestAnimationFrame();
  }

  #restoreTimeScale() {
    if (this.#resumeTimeScale !== null) {
      this.#app.timeScale = this.#resumeTimeScale;
      this.#resumeTimeScale = null;
    }
  }
}
