import {
  DEFAULT_CONTROLS,
  MOVEMENT_DIRECTIONS,
} from "src/game/config/controls.js";
import { CAMERA_DRAG_MODE } from "src/game/enum/CameraDragMode.js";
import { POINTER_TYPE } from "src/game/enum/PointerType.js";

export class GameControls {
  #element;
  #bindings = DEFAULT_CONTROLS;
  #actions;
  #dragPointerId = null;
  #dragMode = null;
  #dragX = 0;
  #dragY = 0;
  #dragDistance = 0;
  #inventoryPointerId = null;
  #movementDirections = new Set();
  #lastMovementTapAt = new Map();

  constructor(element, actions) {
    this.#element = element;
    this.#actions = actions;
  }

  #config() {
    return this.#bindings;
  }

  connect() {
    window.addEventListener("keydown", this.#handleKeydown, true);
    window.addEventListener("keyup", this.#handleKeyup, true);
    window.addEventListener("blur", this.#clearMovement);
    document.addEventListener("visibilitychange", this.#handleVisibilityChange);
    this.#element.addEventListener("wheel", this.#handleWheel, {
      passive: false,
    });
    this.#element.addEventListener("pointerdown", this.#handlePointerDown);
    this.#element.addEventListener("pointermove", this.#handlePointerMove);
    this.#element.addEventListener("pointerup", this.#handlePointerUp);
    this.#element.addEventListener("pointercancel", this.#handlePointerUp);
    this.#element.addEventListener("pointerleave", this.#handlePointerLeave);
  }

  disconnect() {
    window.removeEventListener("keydown", this.#handleKeydown, true);
    window.removeEventListener("keyup", this.#handleKeyup, true);
    window.removeEventListener("blur", this.#clearMovement);
    document.removeEventListener(
      "visibilitychange",
      this.#handleVisibilityChange,
    );
    this.#element.removeEventListener("wheel", this.#handleWheel);
    this.#element.removeEventListener("pointerdown", this.#handlePointerDown);
    this.#element.removeEventListener("pointermove", this.#handlePointerMove);
    this.#element.removeEventListener("pointerup", this.#handlePointerUp);
    this.#element.removeEventListener("pointercancel", this.#handlePointerUp);
    this.#element.removeEventListener(
      "pointerleave",
      this.#handlePointerLeave,
    );
    this.#setDragging(false);
    this.#clearMovement();
  }

  #handleKeydown = (event) => {
    if (this.#isEditable(event.target)) {
      return;
    }

    if (!event.repeat && this.#actions.restartGame?.restart()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    if (this.#matchesKey(event, this.#config().copyScreenshot)) {
      event.preventDefault();
      this.#copyScreenshot();
      return;
    }

    if (this.#matchesKey(event, this.#config().regenerateMap)) {
      event.preventDefault();
      event.returnValue = false;
      event.stopImmediatePropagation();
      this.#actions.regenerateMap.regenerateMap();
      return;
    }

    if (this.#matchesKey(event, this.#config().toggleInventory)) {
      event.preventDefault();
      this.#clearMovement();
      this.#actions.toggleInventory.toggleInventory();
      return;
    }

    if (this.#actions.toggleInventory?.visible) {
      event.preventDefault();
      if (this.#matchesKey(event, this.#config().closeInventory)) {
        this.#actions.toggleInventory.closeInventory();
      }
      return;
    }

    if (this.#matchesKey(event, this.#config().run)) {
      this.#actions.heroMovement.setRunning(true);
      return;
    }

    const movementDirection = this.#movementDirection(event);
    if (movementDirection) {
      event.preventDefault();
      const wasPressed = this.#movementDirections.has(movementDirection);
      if (
        !wasPressed &&
        !event.repeat &&
        this.#isMovementDoubleTap(movementDirection)
      ) {
        if (this.#actions.heroMovement.dodge(movementDirection)) {
          return;
        }
      }
      this.#movementDirections.add(movementDirection);
      this.#actions.heroMovement.setRunning(event.shiftKey);
      this.#actions.heroMovement.setDirection(movementDirection, true);
      return;
    }

    if (this.#matchesKey(event, this.#config().jump)) {
      event.preventDefault();
      this.#actions.heroMovement.jump();
      return;
    }

    if (this.#matchesKey(event, this.#config().interact)) {
      event.preventDefault();
      this.#actions.interaction.interact();
      return;
    }

    const bindings = [
      ["zoomIn", () => this.#actions.zoom.zoomIn()],
      ["zoomOut", () => this.#actions.zoom.zoomOut()],
      [
        "rotateAnticlockwise",
        () => this.#actions.rotateView.rotateAnticlockwise(),
      ],
      ["toggleArrows", () => this.#actions.toggleArrows.toggleArrows()],
    ];

    for (const [name, invoke] of bindings) {
      if (!this.#matchesKey(event, this.#config()[name])) continue;
      event.preventDefault();
      invoke();
      return;
    }
  };

  #handleKeyup = (event) => {
    if (this.#isEditable(event.target)) {
      return;
    }

    if (this.#matchesKey(event, this.#config().regenerateMap)) {
      event.preventDefault();
      event.returnValue = false;
      event.stopImmediatePropagation();
      return;
    }

    if (this.#matchesKey(event, this.#config().run)) {
      this.#actions.heroMovement.setRunning(event.shiftKey);
      return;
    }

    const movementDirection = this.#movementDirection(event);
    if (!movementDirection || !this.#movementDirections.has(movementDirection)) {
      return;
    }
    event.preventDefault();
    this.#movementDirections.delete(movementDirection);
    this.#actions.heroMovement.setDirection(movementDirection, false);
  };

  #handleVisibilityChange = () => {
    if (document.hidden) this.#clearMovement();
  };

  #clearMovement = () => {
    this.#movementDirections.clear();
    this.#lastMovementTapAt.clear();
    this.#actions.heroMovement?.clear();
  };

  #handleWheel = (event) => {
    event.preventDefault();
    if (this.#actions.toggleInventory?.visible) {
      return;
    }
    const rect = this.#element.getBoundingClientRect();
    const pivot = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const direction = event.deltaY < 0 ? "up" : "down";

    if (this.#config().zoomIn.wheelDirection === direction) {
      this.#actions.zoom.zoomIn(pivot);
    } else if (this.#config().zoomOut.wheelDirection === direction) {
      this.#actions.zoom.zoomOut(pivot);
    }
  };

  #handlePointerDown = (event) => {
    if (event.defaultPrevented) {
      return;
    }
    if (this.#actions.toggleInventory?.visible) {
      event.preventDefault();
      const pressed = this.#actions.toggleInventory.pressPointer(
        event.clientX,
        event.clientY,
      );
      if (pressed) {
        this.#inventoryPointerId = event.pointerId;
        this.#element.setPointerCapture(event.pointerId);
      }
      return;
    }
    if (this.#actions.restartGame?.restart()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const isPan =
      event.pointerType === POINTER_TYPE.MOUSE &&
      this.#config().dragCamera.mouseButtons.includes(event.button) &&
      this.#actions.moveCamera.available;
    const isRotate =
      event.pointerType === POINTER_TYPE.MOUSE &&
      event.button === this.#config().rotateCamera.mouseButton;
    if (!isPan && !isRotate) {
      return;
    }

    event.preventDefault();
    this.#dragPointerId = event.pointerId;
    this.#dragMode = isRotate
      ? CAMERA_DRAG_MODE.ROTATE
      : CAMERA_DRAG_MODE.PAN;
    this.#dragX = event.clientX;
    this.#dragY = event.clientY;
    this.#dragDistance = 0;
    this.#setDragging(this.#dragMode === CAMERA_DRAG_MODE.PAN);
    this.#element.setPointerCapture(event.pointerId);
  };

  #handlePointerMove = (event) => {
    if (this.#actions.toggleInventory?.visible) {
      event.preventDefault();
      this.#actions.toggleInventory.movePointer(
        event.clientX,
        event.clientY,
      );
      return;
    }
    if (event.pointerId !== this.#dragPointerId) {
      return;
    }

    const deltaX = event.clientX - this.#dragX;
    const deltaY = event.clientY - this.#dragY;
    this.#dragX = event.clientX;
    this.#dragY = event.clientY;
    this.#dragDistance += Math.hypot(deltaX, deltaY);
    const dragConfig =
      this.#dragMode === CAMERA_DRAG_MODE.ROTATE
        ? this.#config().rotateCamera
        : this.#config().dragCamera;
    if (this.#dragDistance < (dragConfig.activationDistance ?? 0)) {
      return;
    }

    event.preventDefault();
    if (this.#dragMode === CAMERA_DRAG_MODE.ROTATE) {
      this.#actions.rotateView.rotateBy(
        deltaX * this.#config().rotateCamera.quarterTurnsPerPixel,
      );
      return;
    }
    this.#actions.moveCamera.moveBy(deltaX, deltaY);
  };

  #handlePointerUp = (event) => {
    if (event.pointerId === this.#inventoryPointerId) {
      event.preventDefault();
      this.#inventoryPointerId = null;
      if (event.type === "pointercancel") {
        this.#actions.toggleInventory.cancelPointer();
      } else {
        this.#actions.toggleInventory.releasePointer(
          event.clientX,
          event.clientY,
        );
      }
      if (this.#element.hasPointerCapture(event.pointerId)) {
        this.#element.releasePointerCapture(event.pointerId);
      }
      return;
    }
    if (event.pointerId !== this.#dragPointerId) {
      return;
    }

    this.#dragPointerId = null;
    this.#dragMode = null;
    this.#dragDistance = 0;
    this.#setDragging(false);
    if (this.#element.hasPointerCapture(event.pointerId)) {
      this.#element.releasePointerCapture(event.pointerId);
    }
  };

  #handlePointerLeave = () => {
    if (this.#actions.toggleInventory?.visible) {
      this.#actions.toggleInventory.leavePointer();
    }
  };

  #setDragging(isDragging) {
    this.#element.classList.toggle("background-canvas--dragging", isDragging);
    document.documentElement.classList.toggle(
      "game-viewport--dragging",
      isDragging,
    );
  }

  #matchesKey(event, binding) {
    if (!binding?.keys?.length) {
      return false;
    }

    if (
      !binding?.keys.includes(event.code) &&
      !binding?.keys.includes(event.key)
    ) {
      return false;
    }

    const modifierKeys = ["altKey", "ctrlKey", "metaKey", "shiftKey"];
    const eventModifierKey = this.#eventModifierKey(event);
    for (const modifierKey of modifierKeys) {
      if (
        modifierKey === eventModifierKey ||
        binding.allowedModifiers?.includes(modifierKey)
      ) {
        continue;
      }
      if (Boolean(binding[modifierKey]) !== Boolean(event[modifierKey])) {
        return false;
      }
    }
    return binding.allowRepeat !== false || !event.repeat;
  }

  #eventModifierKey(event) {
    if (["Alt", "AltLeft", "AltRight"].includes(event.code)) {
      return "altKey";
    }
    if (["Control", "ControlLeft", "ControlRight"].includes(event.code)) {
      return "ctrlKey";
    }
    if (["Meta", "MetaLeft", "MetaRight"].includes(event.code)) {
      return "metaKey";
    }
    if (["Shift", "ShiftLeft", "ShiftRight"].includes(event.code)) {
      return "shiftKey";
    }
    return null;
  }

  #movementDirection(event) {
    for (const direction of MOVEMENT_DIRECTIONS) {
      const keyName = `move${direction[0].toUpperCase()}${direction.slice(1)}`;
      if (this.#matchesKey(event, this.#config()[keyName])) {
        return direction;
      }
    }
    return null;
  }

  #isMovementDoubleTap(direction) {
    const now = performance.now();
    const previousTapAt = this.#lastMovementTapAt.get(direction);
    const windowMilliseconds =
      (this.#config().dodge?.doubleTapWindow ?? 0) * 1000;
    this.#lastMovementTapAt.set(direction, now);
    if (
      previousTapAt === undefined ||
      now - previousTapAt > windowMilliseconds
    ) {
      return false;
    }

    this.#lastMovementTapAt.delete(direction);
    return true;
  }

  #copyScreenshot() {
    if (!this.#actions.copyScreenshot?.copyScreenshot) {
      return;
    }

    void this.#actions.copyScreenshot.copyScreenshot().catch((error) => {
      console.error("[GameControls] Screenshot failed.", error);
    });
  }

  #isEditable(target) {
    return (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
    );
  }
}
