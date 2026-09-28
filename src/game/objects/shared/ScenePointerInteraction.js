import { INPUT_EVENT_TYPE } from "../../enum/InputEventType.js";
import { POINTER_TYPE } from "../../enum/PointerType.js";

/**
 * @typedef {{start: import("playcanvas").Vec3, end: import("playcanvas").Vec3}} ScenePointerRay
 * @typedef {{capturePointer?: boolean}} PointerHandlerResult
 * @typedef {object} ScenePointerTarget
 * @property {(options: {event: PointerEvent, hit: ScenePointerHit, ray: ScenePointerRay}) => boolean|PointerHandlerResult|void} [handlePointerDown]
 * @property {(options: {event: PointerEvent, ray: ScenePointerRay, deltaTime: number}) => boolean|void} [handlePointerMove]
 * @property {(options: {event: PointerEvent}) => boolean|void} [handlePointerUp]
 * @property {() => void} [handlePointerCancel]
 * @typedef {object} ScenePointerHit
 * @property {number} distance
 * @property {import("playcanvas").Vec3} point
 * @property {import("playcanvas").Entity} [entity]
 * @property {ScenePointerTarget} [pointerTarget]
 * @typedef {ScenePointerTarget & {entity: import("playcanvas").Entity, getPointerHit?: (rayStart: import("playcanvas").Vec3, rayEnd: import("playcanvas").Vec3) => ScenePointerHit|null}} ScenePointerObject
 */

export class ScenePointerInteraction {
  /**
   *
    * @type {HTMLCanvasElement}
   */
  #canvas;
  /**
   *
    * @type {Array<ScenePointerObject>}
   */
  #sceneObjects;
  /**
   *
    * @type {(event: PointerEvent) => ScenePointerRay|null}
   */
  #pointerRay;
  /**
   *
    * @type {((event: PointerEvent) => void)|null}
   */
  #onMousePointerMove;
  /**
   *
    * @type {(() => void)|null}
   */
  #onMousePointerLeave;
  /**
   *
    * @type {ScenePointerTarget|null}
   */
  #activeTarget = null;
  /**
   *
    * @type {number|null}
   */
  #activePointerId = null;
  /**
   *
    * @type {number}
   */
  #activeLastTime = 0;
  /**
   *
    * @type {boolean}
   */
  #connected = false;

  /**
   *
   * @param {{canvas: HTMLCanvasElement, sceneObjects: Array<ScenePointerObject>, pointerRay: (event: PointerEvent) => ScenePointerRay|null, onMousePointerMove: ((event: PointerEvent) => void)|null, onMousePointerLeave: (() => void)|null}} options
   * @param {HTMLCanvasElement} options.canvas
   * @param {Array<ScenePointerObject>} options.sceneObjects
   * @param {(event: PointerEvent) => ScenePointerRay|null} options.pointerRay
   * @param {(event: PointerEvent) => void} options.onMousePointerMove
   * @param {() => void} options.onMousePointerLeave
   */
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

  /**
   *
   * @param {PointerEvent} event
    * @type {(event: PointerEvent) => void}
   */
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

  /**
   *
   * @param {PointerEvent} event
    * @type {(event: PointerEvent) => void}
   */
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

  /**
   *
   * @param {PointerEvent} event
    * @type {(event: PointerEvent) => void}
   */
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

  /**
   *
   * @param {PointerEvent} event
    * @type {(event: PointerEvent) => void}
   */
  #handlePointerCancel = (event) => {
    if (event.pointerId !== this.#activePointerId) {
      return;
    }
    event.preventDefault();
    this.cancelActivePointer();
  };

  /**
   *
   * @param {PointerEvent} event
    * @type {(event: PointerEvent) => void}
   */
  #handlePointerLeave = (event) => {
    if (event.pointerType === POINTER_TYPE.MOUSE) {
      this.#onMousePointerLeave?.();
    }
  };

  /**
   *
   * @param {ScenePointerRay} ray
   */
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

  /**
   *
   * @param {{object: ScenePointerObject, hit: ScenePointerHit}} options
   * @param {ScenePointerObject} options.object
   * @param {ScenePointerHit} options.hit
   */
  #hitTarget({ object, hit }) {
    return hit.pointerTarget ?? object;
  }

  /**
   *
   * @param {ScenePointerTarget} target
   * @param {boolean|PointerHandlerResult|void} result
   */
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
