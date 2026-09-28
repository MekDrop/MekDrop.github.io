export class RotateViewAction {
  /**
   *
   * @type {PlayCanvasRenderer}
   */
  #renderer;
  /**
   *
   * @type {(value: boolean|number|string|null) => void}
   */
  #onChange;

  /**
   *
   * @param {PlayCanvasRenderer} renderer
   * @param {(value: boolean|number|(value: boolean|number|string|null) => void|null) => void} onChange
   */
  constructor(renderer, onChange = () => {}) {
    /**
     *
     * @type {PlayCanvasRenderer}
     */
    this.#renderer = renderer;
    /**
     *
     * @type {(value: boolean|number|string|null) => void}
     */
    this.#onChange = onChange;
  }

  invoke() {
    if (this.#renderer.inventoryVisible) {
      return this.#renderer.rotation;
    }
    return this.rotateAnticlockwise();
  }

  rotateAnticlockwise() {
    return this.rotateBy(-1);
  }

  rotateClockwise() {
    return this.rotateBy(1);
  }

  /**
   *
   * @param {number} quarterTurns
   * @param {number} verticalQuarterTurns
   */
  rotateBy(quarterTurns, verticalQuarterTurns = 0) {
    const rotation = this.#renderer.rotateBy(
      quarterTurns,
      verticalQuarterTurns,
    );
    this.#onChange(rotation);
    return rotation;
  }
}
