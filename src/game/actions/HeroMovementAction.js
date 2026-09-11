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

  constructor(renderer) {
    this.#renderer = renderer;
  }

  invoke(event) {
    if (this.#renderer.inventoryVisible) {
      return;
    }
    this.setRunning(event.type === "keydown" || event.shiftKey);
  }

  pressDirection(direction, event, doubleTapWindow) {
    if (this.#renderer.inventoryVisible) {
      return;
    }
    const wasPressed = this.#directions[direction];
    if (
      !wasPressed &&
      !event.repeat &&
      this.#isDirectionDoubleTap(direction, doubleTapWindow) &&
      this.dodge(direction)
    ) {
      return;
    }

    this.setRunning(event.shiftKey);
    this.setDirection(direction, true);
  }

  releaseDirection(direction) {
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
