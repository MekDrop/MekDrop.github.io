export class CameraPointerAction {
  #renderer;
  #element;
  #primaryAction;
  #degreesPerPixel;

  constructor(renderer, element, primaryAction, { degreesPerPixel } = {}) {
    this.#renderer = renderer;
    this.#element = element;
    this.#primaryAction = primaryAction;
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

  move(event) {
    return this.#renderer.cameraPointerMove({
      captured: document.pointerLockElement === this.#element,
      movementX: event.movementX,
      movementY: event.movementY,
      degreesPerPixel: this.#degreesPerPixel,
    });
  }
}
