import { CAMERA_DRAG_MODE } from "src/game/enum/CameraDragMode.js";
import { POINTER_TYPE } from "src/game/enum/PointerType.js";

export class CameraDrag {
  /**
   *
   * @type {HTMLElement}
   */
  #element;
  /**
   *
   * @type {(deltaX: number, deltaY: number) => void}
   */
  #moveCamera;
  /**
   *
   * @type {(direction: number) => void}
   */
  #rotateView;
  /**
   *
   * @type {{sensitivity: number, threshold?: number}}
   */
  #panConfig;
  /**
   *
   * @type {{sensitivity: number, threshold?: number}}
   */
  #rotateConfig;
  /**
   *
   * @type {null}
   */
  #pointerId = null;
  /**
   *
   * @type {null}
   */
  #mode = null;
  /**
   *
   * @type {number}
   */
  #x = 0;
  /**
   *
   * @type {number}
   */
  #y = 0;
  /**
   *
   * @type {number}
   */
  #distance = 0;

  /**
   *
   * @param {HTMLElement} element
   * @param {{moveCamera: (deltaX: number, deltaY: number) => void, rotateView: (direction: number) => void}} options
   * @param {(deltaX: number, deltaY: number) => void} options.moveCamera
   * @param {(direction: number) => void} options.rotateView
   * @param {{dragCamera: {mouseButtons: number[]}, rotateCamera: {mouseButton: number, quarterTurnsPerPixel: number}}} config0
   * @param {{mouseButtons: number[]}} config0.dragCamera
   * @param {{mouseButton: number, quarterTurnsPerPixel: number}} config0.rotateCamera
   */
  constructor(
    element,
    { moveCamera, rotateView },
    { dragCamera, rotateCamera },
  ) {
    /**
     *
     * @type {HTMLElement}
     */
    this.#element = element;
    /**
     *
     * @type {(deltaX: number, deltaY: number) => void}
     */
    this.#moveCamera = moveCamera;
    /**
     *
     * @type {(direction: number) => void}
     */
    this.#rotateView = rotateView;
    /**
     *
     * @type {{sensitivity: number, threshold?: number}}
     */
    this.#panConfig = dragCamera;
    /**
     *
     * @type {{sensitivity: number, threshold?: number}}
     */
    this.#rotateConfig = rotateCamera;
  }

  /**
   *
   * @param {Event} event
   */
  start(event) {
    const isPan =
      event.pointerType === POINTER_TYPE.MOUSE &&
      this.#panConfig.mouseButtons.includes(event.button) &&
      this.#moveCamera.available;
    const isRotate =
      event.pointerType === POINTER_TYPE.MOUSE &&
      event.button === this.#rotateConfig.mouseButton;
    if (!isPan && !isRotate) {
      return false;
    }

    event.preventDefault();
    this.#pointerId = event.pointerId;
    this.#mode = isRotate ? CAMERA_DRAG_MODE.ROTATE : CAMERA_DRAG_MODE.PAN;
    this.#x = event.clientX;
    this.#y = event.clientY;
    this.#distance = 0;
    this.#setDragging(this.#mode === CAMERA_DRAG_MODE.PAN);
    this.#element.setPointerCapture(event.pointerId);
    return true;
  }

  /**
   *
   * @param {Event} event
   */
  move(event) {
    if (event.pointerId !== this.#pointerId) {
      return false;
    }

    const deltaX = event.clientX - this.#x;
    const deltaY = event.clientY - this.#y;
    this.#x = event.clientX;
    this.#y = event.clientY;
    this.#distance += Math.hypot(deltaX, deltaY);
    const config =
      this.#mode === CAMERA_DRAG_MODE.ROTATE
        ? this.#rotateConfig
        : this.#panConfig;
    if (this.#distance < (config.activationDistance ?? 0)) {
      return true;
    }

    event.preventDefault();
    if (this.#mode === CAMERA_DRAG_MODE.ROTATE) {
      this.#rotateView.rotateBy(
        deltaX * this.#rotateConfig.quarterTurnsPerPixel,
        deltaY * this.#rotateConfig.quarterTurnsPerPixel,
      );
      return true;
    }

    this.#moveCamera.moveBy(deltaX, deltaY);
    return true;
  }

  /**
   *
   * @param {Event} event
   */
  end(event) {
    if (event.pointerId !== this.#pointerId) {
      return false;
    }

    this.#releasePointer(event.pointerId);
    this.#reset();
    return true;
  }

  cancel() {
    if (this.#pointerId !== null) {
      this.#releasePointer(this.#pointerId);
    }
    this.#reset();
  }

  /**
   *
   * @param {number} pointerId
   */
  #releasePointer(pointerId) {
    if (this.#element.hasPointerCapture(pointerId)) {
      this.#element.releasePointerCapture(pointerId);
    }
  }

  #reset() {
    this.#pointerId = null;
    this.#mode = null;
    this.#distance = 0;
    this.#setDragging(false);
  }

  /**
   *
   * @param {boolean} isDragging
   */
  #setDragging(isDragging) {
    this.#element.classList.toggle("background-canvas--dragging", isDragging);
    document.documentElement.classList.toggle(
      "game-viewport--dragging",
      isDragging,
    );
  }
}
