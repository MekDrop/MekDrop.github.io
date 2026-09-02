export class RegenerateMapAction {
  #renderer;
  #generateMap;
  #onGenerated;

  constructor(renderer, generateMap, onGenerated = () => {}) {
    this.#renderer = renderer;
    this.#generateMap = generateMap;
    this.#onGenerated = onGenerated;
  }

  regenerateMap() {
    const viewport = this.#renderer.getViewport();
    const mapData = this.#generateMap();

    this.#renderer.render(mapData);
    this.#renderer.setViewport(viewport);
    this.#onGenerated(mapData);

    return mapData;
  }
}
