import { INPUT_EVENT_TYPE } from "../enum/InputEventType.js";

const MOVEMENT_VECTORS = Object.freeze({
  up: { x: 0, y: 1 },
  down: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
});

export class HeroMovementAction {
  /**
   *
   * @type {PlayCanvasRenderer}
   */
  #renderer;
  /**
   *
   * @type {Readonly<Record<string, number>>}
   */
  #directions = {
    up: false,
    down: false,
    left: false,
    right: false,
  };
  /**
   *
   * @type {boolean}
   */
  #running = false;
  /**
   *
   * @type {Map}
   */
  #lastDirectionTapAt = new Map();
  /**
   *
   * @type {Map}
   */
  #dodgeFacingAtFirstTap = new Map();
  /**
   *
   * @type {Set}
   */
  #consumedDodgeDirections = new Set();

  /**
   *
   * @param {PlayCanvasRenderer} renderer
   */
  constructor(renderer) {
    /**
     *
     * @type {PlayCanvasRenderer}
     */
    this.#renderer = renderer;
  }

  /**
   *
   * @returns {Hero|null}
   */
  get #hero() {
    return this.#renderer.hero;
  }

  /**
   *
   * @param {Event} event
   */
  invoke(event) {
    if (this.#renderer.inventoryVisible) {
      return;
    }
    this.setRunning(
      event.type === INPUT_EVENT_TYPE.KEY_DOWN || event.shiftKey,
    );
  }

  /**
   *
   * @param {string} direction
   * @param {Event} event
   * @param {number} doubleTapWindow
   */
  pressDirection(direction, event, doubleTapWindow) {
    if (this.#renderer.inventoryVisible) {
      return;
    }
    if (this.#consumedDodgeDirections.has(direction)) {
      return;
    }
    const wasPressed = this.#directions[direction];
    const hero = this.#hero;
    const firstTapFacing = this.#dodgeFacingAtFirstTap.get(direction);
    if (!wasPressed && !event.repeat) {
      const isDoubleTap = this.#isDirectionDoubleTap(
        direction,
        doubleTapWindow,
      );
      if (isDoubleTap && this.dodge(direction, firstTapFacing)) {
        this.#dodgeFacingAtFirstTap.delete(direction);
        this.#consumedDodgeDirections.add(direction);
        return;
      }
      this.#dodgeFacingAtFirstTap.set(direction, hero?.facingDirection ?? null);
      if (direction === "down" && hero) {
        const input = MOVEMENT_VECTORS[direction];
        hero.facingHoldDuration = doubleTapWindow;
        hero.movementAnimationHoldDuration = doubleTapWindow;
        hero.queueFacingInput?.(input.x, input.y);
      } else if (hero) {
        hero.facingHoldDuration = 0;
        hero.movementAnimationHoldDuration = 0;
      }
    }

    this.setRunning(event.shiftKey);
    this.setDirection(direction, true);
  }

  /**
   *
   * @param {string} direction
   */
  releaseDirection(direction) {
    this.#consumedDodgeDirections.delete(direction);
    if (!this.#directions[direction]) {
      return;
    }
    this.setDirection(direction, false);
  }

  /**
   *
   * @param {string} direction
   * @param {boolean} pressed
   */
  setDirection(direction, pressed) {
    if (!(direction in this.#directions)) {
      return;
    }
    this.#directions[direction] = pressed;
    this.#applyMovement();
  }

  /**
   *
   * @param {boolean} running
   */
  setRunning(running) {
    this.#running = running;
    this.#applyMovement();
  }

  jump() {
    if (this.#renderer.inventoryVisible) {
      return;
    }
    this.#hero?.jump();
  }

  /**
   *
   * @param {string} direction
   * @param {null} facing
   */
  dodge(direction, facing = null) {
    const input = MOVEMENT_VECTORS[direction];
    if (!input) {
      return false;
    }
    return this.#hero?.dodge(input.x, input.y, direction, { facing }) ?? false;
  }

  clear() {
    for (const direction of Object.keys(this.#directions)) {
      this.#directions[direction] = false;
    }
    this.#running = false;
    this.#lastDirectionTapAt.clear();
    this.#dodgeFacingAtFirstTap.clear();
    this.#consumedDodgeDirections.clear();
    const hero = this.#hero;
    if (hero) {
      hero.facingHoldDuration = 0;
      hero.movementAnimationHoldDuration = 0;
      hero.clearQueuedFacingInput?.();
    }
    this.#applyMovement();
  }

  /**
   *
   * @param {string} direction
   * @param {number} doubleTapWindow
   */
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
    this.#hero?.setMovement(
      x,
      y,
      this.#running && (x !== 0 || y !== 0),
    );
  }
}
