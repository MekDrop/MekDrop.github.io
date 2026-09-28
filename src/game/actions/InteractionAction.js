export class InteractionAction {
  /**
   *
   * @type {PlayCanvasRenderer}
   */
  #renderer;

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

  invoke() {
    if (this.#renderer.inventoryVisible) {
      return false;
    }
    return this.interact();
  }

  interact() {
    return this.#renderer.interact();
  }
}
