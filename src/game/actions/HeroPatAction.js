export class HeroPatAction {
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
    return this.#renderer.patHero();
  }
}
