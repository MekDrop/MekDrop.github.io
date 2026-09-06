export class RegenerateMapAction {
  #renderer;
  #generateMap;
  #onGenerated;

  constructor(renderer, generateMap, onGenerated = () => {}) {
    this.#renderer = renderer;
    this.#generateMap = generateMap;
    this.#onGenerated = onGenerated;
  }

  regenerateMap(viewport = this.#renderer.viewport) {
    const mapData = this.#generateMap();

    this.#renderer.render(mapData);
    this.#renderer.setViewport(viewport);
    this.#onGenerated(mapData);

    return mapData;
  }
}
