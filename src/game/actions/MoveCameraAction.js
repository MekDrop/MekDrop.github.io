export class MoveCameraAction {
  #renderer;
  #step;

  constructor(renderer, { step }) {
    this.#renderer = renderer;
    this.#step = Number.isFinite(step) ? step : 0;
  }

  get available() {
    return this.#renderer.canPan;
  }

  moveUp() {
    this.moveBy(0, this.#step);
  }

  moveDown() {
    this.moveBy(0, -this.#step);
  }

  moveLeft() {
    this.moveBy(this.#step, 0);
  }

  moveRight() {
    this.moveBy(-this.#step, 0);
  }

  moveBy(deltaX, deltaY) {
    this.#renderer.panBy(deltaX, deltaY);
  }
}
