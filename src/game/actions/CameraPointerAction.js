export class CameraPointerAction {
  /**
   *
   * @type {PlayCanvasRenderer}
   */
  #renderer;
  /**
   *
   * @type {HTMLElement}
   */
  #element;
  /**
   *
   * @type {import("src/game/GameContracts.js").GameActionContract}
   */
  #primaryAction;
  /**
   *
   * @type {number}
   */
  #degreesPerPixel;

  /**
   *
   * @param {PlayCanvasRenderer} renderer
   * @param {HTMLElement} element
   * @param {import("src/game/GameContracts.js").GameActionContract} primaryAction
   * @param {{degreesPerPixel: number}} options
   * @param {number} options.degreesPerPixel
   */
  constructor(renderer, element, primaryAction, { degreesPerPixel } = {}) {
    /**
     *
     * @type {PlayCanvasRenderer}
     */
    this.#renderer = renderer;
    /**
     *
     * @type {HTMLElement}
     */
    this.#element = element;
    /**
     *
     * @type {import("src/game/GameContracts.js").GameActionContract}
     */
    this.#primaryAction = primaryAction;
    /**
     *
     * @type {number}
     */
    this.#degreesPerPixel = Number.isFinite(degreesPerPixel)
      ? degreesPerPixel
      : 0.12;
  }

  capture() {
    if (!this.#renderer.cameraPointerInputActive) {
      return false;
    }
    const request = this.#element.requestPointerLock?.();
    if (request?.catch) {
      void request.catch(() => {});
    }
    return true;
  }

  release() {
    if (document.pointerLockElement !== this.#element) {
      return false;
    }
    document.exitPointerLock?.();
    return true;
  }

  /**
   *
   * @param {Event} event
   */
  press(event) {
    const command = this.#renderer.cameraPointerDown({
      button: event.button,
      captured: document.pointerLockElement === this.#element,
    });
    if (!command) {
      return false;
    }
    if (command.capture) {
      this.capture();
    }
    if (command.primary) {
      this.#primaryAction?.invoke();
    }
    return true;
  }

  /**
   *
   * @param {Event} event
   */
  move(event) {
    return this.#renderer.cameraPointerMove({
      captured: document.pointerLockElement === this.#element,
      movementX: event.movementX,
      movementY: event.movementY,
      degreesPerPixel: this.#degreesPerPixel,
    });
  }
}
