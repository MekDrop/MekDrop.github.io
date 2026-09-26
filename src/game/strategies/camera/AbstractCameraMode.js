/**
 * @abstract
 */
export class AbstractCameraMode {
  #gameCamera;

  constructor(gameCamera) {
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
   * Apply the mode transform and report its resulting position.
   *
   * @abstract
   */
  update() {}
}
