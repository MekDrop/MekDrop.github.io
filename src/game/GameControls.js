import {
  DEFAULT_CONTROLS,
  MOVEMENT_DIRECTIONS,
} from "src/game/config/controls.js";

export class GameControls {
  #element;
  #bindings = DEFAULT_CONTROLS;
  #actions;
  #dragPointerId = null;
  #dragMode = null;
  #dragX = 0;
  #dragY = 0;
  #dragDistance = 0;
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

    if (this.#isEditable(event.target)) {
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
      this.#actions.vegetationInteraction.interact();
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
    if (this.#actions.restartGame?.restart()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const isPan =
      event.pointerType === "mouse" &&
      this.#config().dragCamera.mouseButtons.includes(event.button);
    const isRotate =
      event.pointerType === "mouse" &&
      event.button === this.#config().rotateCamera.mouseButton;
    if (!isPan && !isRotate) {
      return;
    }

    event.preventDefault();
    this.#dragPointerId = event.pointerId;
    this.#dragMode = isRotate ? "rotate" : "pan";
    this.#dragX = event.clientX;
    this.#dragY = event.clientY;
    this.#dragDistance = 0;
    this.#setDragging(true);
    this.#element.setPointerCapture(event.pointerId);
  };

  #handlePointerMove = (event) => {
    if (event.pointerId !== this.#dragPointerId) {
      return;
    }

    const deltaX = event.clientX - this.#dragX;
    const deltaY = event.clientY - this.#dragY;
    this.#dragX = event.clientX;
    this.#dragY = event.clientY;
    this.#dragDistance += Math.hypot(deltaX, deltaY);
    const dragConfig =
      this.#dragMode === "rotate"
        ? this.#config().rotateCamera
        : this.#config().dragCamera;
    if (this.#dragDistance < (dragConfig.activationDistance ?? 0)) {
      return;
    }

    event.preventDefault();
    if (this.#dragMode === "rotate") {
      this.#actions.rotateView.rotateBy(
        deltaX * this.#config().rotateCamera.quarterTurnsPerPixel,
      );
      return;
    }
    this.#actions.moveCamera.moveBy(deltaX, deltaY);
  };

  #handlePointerUp = (event) => {
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
    if (binding.ctrlKey !== undefined && binding.ctrlKey !== event.ctrlKey) {
      return false;
    }
    return binding.allowRepeat !== false || !event.repeat;
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
