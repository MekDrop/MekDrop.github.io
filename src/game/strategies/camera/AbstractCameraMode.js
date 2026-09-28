/**
 * @abstract
 */
export class AbstractCameraMode {
  /**
   *
   * @type {GameCamera}
   */
  #gameCamera;

  /**
   *
   * @param {GameCamera} gameCamera
   */
  constructor(gameCamera) {
    /**
     *
     * @type {GameCamera}
     */
    this.#gameCamera = gameCamera;
  }

  get gameCamera() {
    return this.#gameCamera;
  }

  /**
   * Configure projection and transient state when this mode becomes active.
   */
  enter() {}

  /**
   * Clear transient state before another mode becomes active.
   */
  exit() {}

  /**
   *
   * @returns {boolean}
   */
  get pointerInputActive() {
    return false;
  }

  pointerDown() {
    return null;
  }

  pointerMove() {
    return false;
  }

  /**
   * Apply the mode transform and report its resulting position.
   *
   * @abstract
   */
  update() {}
}
