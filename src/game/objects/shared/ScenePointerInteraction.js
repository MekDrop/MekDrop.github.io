import { INPUT_EVENT_TYPE } from "../../enum/InputEventType.js";
import { POINTER_TYPE } from "../../enum/PointerType.js";

export class ScenePointerInteraction {
  #canvas;
  #sceneObjects;
  #pointerRay;
  #onMousePointerMove;
  #onMousePointerLeave;
  #activeTarget = null;
  #activePointerId = null;
  #activeLastTime = 0;
  #connected = false;

  constructor({
    canvas,
    sceneObjects,
    pointerRay,
    onMousePointerMove = null,
    onMousePointerLeave = null,
  }) {
    this.#canvas = canvas;
    this.#sceneObjects = sceneObjects;
    this.#pointerRay = pointerRay;
    this.#onMousePointerMove = onMousePointerMove;
    this.#onMousePointerLeave = onMousePointerLeave;
  }

  connect() {
    if (this.#connected || !this.#canvas) {
      return;
    }
    this.#canvas.addEventListener(
      INPUT_EVENT_TYPE.POINTER_DOWN,
      this.#handlePointerDown,
    );
    this.#canvas.addEventListener(
      INPUT_EVENT_TYPE.POINTER_MOVE,
      this.#handlePointerMove,
    );
    this.#canvas.addEventListener(
      INPUT_EVENT_TYPE.POINTER_UP,
      this.#handlePointerUp,
    );
    this.#canvas.addEventListener(
      INPUT_EVENT_TYPE.POINTER_CANCEL,
      this.#handlePointerCancel,
    );
    this.#canvas.addEventListener(
      INPUT_EVENT_TYPE.POINTER_LEAVE,
      this.#handlePointerLeave,
    );
    this.#connected = true;
  }

  disconnect() {
    if (!this.#connected || !this.#canvas) {
      return;
    }
    this.#canvas.removeEventListener(
      INPUT_EVENT_TYPE.POINTER_DOWN,
      this.#handlePointerDown,
    );
    this.#canvas.removeEventListener(
      INPUT_EVENT_TYPE.POINTER_MOVE,
      this.#handlePointerMove,
    );
    this.#canvas.removeEventListener(
      INPUT_EVENT_TYPE.POINTER_UP,
      this.#handlePointerUp,
    );
    this.#canvas.removeEventListener(
      INPUT_EVENT_TYPE.POINTER_CANCEL,
      this.#handlePointerCancel,
    );
    this.#canvas.removeEventListener(
      INPUT_EVENT_TYPE.POINTER_LEAVE,
      this.#handlePointerLeave,
    );
    this.cancelActivePointer();
    this.#connected = false;
  }

  cancelActivePointer() {
    this.#activeTarget?.handlePointerCancel?.();
    this.#releaseActivePointer();
  }

  #handlePointerDown = (event) => {
    if (event.defaultPrevented || event.button !== 0 || this.#activeTarget) {
      return;
    }
    const ray = this.#pointerRay(event);
    if (!ray) {
      return;
    }
    const closest = this.#findClosestHit(ray);
    const target = closest ? this.#hitTarget(closest) : null;
    if (!target?.handlePointerDown) {
      return;
    }

    const result = target.handlePointerDown({
      event,
      hit: closest.hit,
      ray,
    });
    if (result === false) {
      return;
    }
    event.preventDefault();
    if (!this.#shouldCapturePointer(target, result)) {
      return;
    }
    this.#activeTarget = target;
    this.#activePointerId = event.pointerId;
    this.#activeLastTime = event.timeStamp;
    this.#canvas.setPointerCapture(event.pointerId);
  };

  #handlePointerMove = (event) => {
    if (event.pointerType === POINTER_TYPE.MOUSE) {
      this.#onMousePointerMove?.(event);
    }
    if (!this.#activeTarget || event.pointerId !== this.#activePointerId) {
      return;
    }
    const ray = this.#pointerRay(event);
    if (!ray) {
      return;
    }

    const deltaTime = (event.timeStamp - this.#activeLastTime) / 1000;
    this.#activeLastTime = event.timeStamp;
    const result = this.#activeTarget.handlePointerMove?.({
      event,
      ray,
      deltaTime,
    });
    if (result !== false) {
      event.preventDefault();
    }
  };

  #handlePointerUp = (event) => {
    if (event.pointerId !== this.#activePointerId) {
      return;
    }
    const result = this.#activeTarget?.handlePointerUp?.({ event });
    if (result !== false) {
      event.preventDefault();
    }
    this.#releaseActivePointer();
  };

  #handlePointerCancel = (event) => {
    if (event.pointerId !== this.#activePointerId) {
      return;
    }
    event.preventDefault();
    this.cancelActivePointer();
  };

  #handlePointerLeave = (event) => {
    if (event.pointerType === POINTER_TYPE.MOUSE) {
      this.#onMousePointerLeave?.();
    }
  };

  #findClosestHit(ray) {
    let closest = null;
    for (const object of this.#sceneObjects) {
      const hit = object.getPointerHit?.(ray.start, ray.end);
      if (!hit || (closest && hit.distance >= closest.hit.distance)) {
        continue;
      }
      closest = { object, hit };
    }
    return closest;
  }

  #hitTarget({ object, hit }) {
    return hit.pointerTarget ?? object;
  }

  #shouldCapturePointer(target, result) {
    if (typeof result === "object" && result !== null) {
      return Boolean(result.capturePointer);
    }
    return Boolean(target.handlePointerMove || target.handlePointerUp);
  }

  #releaseActivePointer() {
    if (
      this.#activePointerId !== null &&
      this.#canvas?.hasPointerCapture(this.#activePointerId)
    ) {
      this.#canvas.releasePointerCapture(this.#activePointerId);
    }
    this.#activeTarget = null;
    this.#activePointerId = null;
    this.#activeLastTime = 0;
  }
}
