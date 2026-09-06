export class RestartGameAction {
  #renderer;
  #regenerateMap;

  constructor(renderer, regenerateMap) {
    this.#renderer = renderer;
    this.#regenerateMap = regenerateMap;
  }

  restart() {
    if (!this.#renderer.isGameOver()) {
      return false;
    }
    const viewport = this.#renderer.gameOverReturnViewport;
    this.#regenerateMap.regenerateMap(viewport);
    return true;
  }
}
