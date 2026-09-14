import { INPUT_EVENT_TYPE } from "../enum/InputEventType.js";

const MOVEMENT_VECTORS = Object.freeze({
  up: { x: 0, y: 1 },
  down: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
});

export class HeroMovementAction {
  #renderer;
  #directions = {
    up: false,
    down: false,
    left: false,
    right: false,
  };
  #running = false;
  #lastDirectionTapAt = new Map();
  #consumedDodgeDirections = new Set();

  constructor(renderer) {
    this.#renderer = renderer;
  }

  invoke(event) {
    if (this.#renderer.inventoryVisible) {
      return;
    }
    this.setRunning(
      event.type === INPUT_EVENT_TYPE.KEY_DOWN || event.shiftKey,
    );
  }

  pressDirection(direction, event, doubleTapWindow) {
    if (this.#renderer.inventoryVisible) {
      return;
    }
    if (this.#consumedDodgeDirections.has(direction)) {
      return;
    }
    const wasPressed = this.#directions[direction];
    if (
      !wasPressed &&
      !event.repeat &&
      this.#isDirectionDoubleTap(direction, doubleTapWindow) &&
      this.dodge(direction)
    ) {
      this.#consumedDodgeDirections.add(direction);
      return;
    }

    if (!wasPressed && !event.repeat) {
      // Let a backward double-tap resolve before turning toward a normal walk.
      this.#renderer.heroFacingHoldDuration =
        direction === "down" ? doubleTapWindow : 0;
    }
    this.setRunning(event.shiftKey);
    this.setDirection(direction, true);
  }

  releaseDirection(direction) {
    this.#consumedDodgeDirections.delete(direction);
    if (!this.#directions[direction]) {
      return;
    }
    this.setDirection(direction, false);
  }

  setDirection(direction, pressed) {
    if (!(direction in this.#directions)) {
      return;
    }
    this.#directions[direction] = pressed;
    this.#applyMovement();
  }

  setRunning(running) {
    this.#running = running;
    this.#applyMovement();
  }

  jump() {
    if (this.#renderer.inventoryVisible) {
      return;
    }
    this.#renderer.jumpHero();
  }

  dodge(direction) {
    const input = MOVEMENT_VECTORS[direction];
    if (!input) {
      return false;
    }
    return this.#renderer.dodgeHero(input.x, input.y, direction);
  }

  clear() {
    for (const direction of Object.keys(this.#directions)) {
      this.#directions[direction] = false;
    }
    this.#running = false;
    this.#lastDirectionTapAt.clear();
    this.#consumedDodgeDirections.clear();
    this.#renderer.heroFacingHoldDuration = 0;
    this.#applyMovement();
  }

  #isDirectionDoubleTap(direction, doubleTapWindow) {
    const now = performance.now();
    const previousTapAt = this.#lastDirectionTapAt.get(direction);
    const windowMilliseconds = (doubleTapWindow ?? 0) * 1000;
    this.#lastDirectionTapAt.set(direction, now);
    if (
      previousTapAt === undefined ||
      now - previousTapAt > windowMilliseconds
    ) {
      return false;
    }

    this.#lastDirectionTapAt.delete(direction);
    return true;
  }

  #applyMovement() {
    const x =
      Number(this.#directions.right) - Number(this.#directions.left);
    const y = Number(this.#directions.up) - Number(this.#directions.down);
    this.#renderer.setHeroMovement(
      x,
      y,
      this.#running && (x !== 0 || y !== 0),
    );
  }
}
