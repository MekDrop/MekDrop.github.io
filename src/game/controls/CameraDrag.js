import { CAMERA_DRAG_MODE } from "src/game/enum/CameraDragMode.js";
import { POINTER_TYPE } from "src/game/enum/PointerType.js";

export class CameraDrag {
  #element;
  #moveCamera;
  #rotateView;
  #panConfig;
  #rotateConfig;
  #pointerId = null;
  #mode = null;
  #x = 0;
  #y = 0;
  #distance = 0;

  constructor(
    element,
    { moveCamera, rotateView },
    { dragCamera, rotateCamera },
  ) {
    this.#element = element;
    this.#moveCamera = moveCamera;
    this.#rotateView = rotateView;
    this.#panConfig = dragCamera;
    this.#rotateConfig = rotateCamera;
  }

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

  #setDragging(isDragging) {
    this.#element.classList.toggle("background-canvas--dragging", isDragging);
    document.documentElement.classList.toggle(
      "game-viewport--dragging",
      isDragging,
    );
  }
}
