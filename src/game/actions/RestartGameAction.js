export class RestartGameAction {
  /**
   *
   * @type {PlayCanvasRenderer}
   */
  #renderer;
  /**
   *
   * @type {() => import("src/game/GameContracts.js").GameMapData|Promise<import("src/game/GameContracts.js").GameMapData>}
   */
  #regenerateMap;

  /**
   *
   * @param {PlayCanvasRenderer} renderer
   * @param {() => import("src/game/GameContracts.js").GameMapData|Promise<import("src/game/GameContracts.js").GameMapData>} regenerateMap
   */
  constructor(renderer, regenerateMap) {
    /**
     *
     * @type {PlayCanvasRenderer}
     */
    this.#renderer = renderer;
    /**
     *
     * @type {() => import("src/game/GameContracts.js").GameMapData|Promise<import("src/game/GameContracts.js").GameMapData>}
     */
    this.#regenerateMap = regenerateMap;
  }

  restart() {
    if (!this.#renderer.isGameOver()) {
      return false;
    }
    const viewport = this.#renderer.gameOverReturnViewport;
    void this.#regenerateMap.regenerateMap(viewport);
    return true;
  }
}
