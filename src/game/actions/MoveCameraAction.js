export class MoveCameraAction {
  /**
   *
   * @type {PlayCanvasRenderer}
   */
  #renderer;
  /**
   *
   * @type {number}
   */
  #step;

  /**
   *
   * @param {PlayCanvasRenderer} renderer
   * @param {{step: number}} options
   * @param {number} options.step
   */
  constructor(renderer, { step }) {
    /**
     *
     * @type {PlayCanvasRenderer}
     */
    this.#renderer = renderer;
    /**
     *
     * @type {number}
     */
    this.#step = Number.isFinite(step) ? step : 0;
  }

  /**
   *
   * @returns {boolean}
   */
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

  /**
   *
   * @param {number} deltaX
   * @param {number} deltaY
   */
  moveBy(deltaX, deltaY) {
    this.#renderer.panBy(deltaX, deltaY);
  }
}
