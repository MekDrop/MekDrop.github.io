export class RegenerateMapAction {
  #renderer;
  #generateMap;
  #onGenerated;
  #onGenerationError;

  constructor(
    renderer,
    generateMap,
    onGenerated = () => {},
    onGenerationError = () => {},
  ) {
    this.#renderer = renderer;
    this.#generateMap = generateMap;
    this.#onGenerated = onGenerated;
    this.#onGenerationError = onGenerationError;
  }

  regenerateMap(viewport = this.#renderer.viewport) {
    let mapData;
    try {
      mapData = this.#generateMap();
    } catch (error) {
      this.#onGenerationError(error);
      return null;
    }
    if (!mapData) {
      return null;
    }

    this.#renderer.render(mapData);
    this.#renderer.setViewport(viewport);
    this.#onGenerated(mapData);

    return mapData;
  }
}
