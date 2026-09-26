import { INPUT_EVENT_TYPE } from "../enum/InputEventType.js";

export class RegenerateMapAction {
  #renderer;
  #generateMap;
  #onGenerated;
  #onGenerationError;
  #beforeGeneration;
  #beforeRender;
  #afterRender;
  #onComplete;
  #onLifecycle;

  constructor(
    renderer,
    generateMap,
    {
      onGenerated = () => {},
      onGenerationError = () => {},
      beforeGeneration = null,
      beforeRender = null,
      afterRender = null,
      onComplete = null,
      onLifecycle = () => {},
    } = {},
  ) {
    this.#renderer = renderer;
    this.#generateMap = generateMap;
    this.#onGenerated = onGenerated;
    this.#onGenerationError = onGenerationError;
    this.#beforeGeneration = beforeGeneration;
    this.#beforeRender = beforeRender;
    this.#afterRender = afterRender;
    this.#onComplete = onComplete;
    this.#onLifecycle = onLifecycle;
  }

  invoke(event) {
    if (event.type === INPUT_EVENT_TYPE.KEY_UP) {
      return null;
    }
    return this.regenerateMap();
  }

  regenerateMap(viewport = this.#renderer.viewport) {
    const lifecycle = this.#runRegeneration(viewport);
    this.#onLifecycle(lifecycle);
    return lifecycle;
  }

  async #runRegeneration(viewport) {
    let operation;
    try {
      operation = await this.#beforeGeneration?.();
      const mapData = await this.#generateMap();
      if (!mapData) {
        return null;
      }

      await this.#beforeRender?.(mapData, operation);
      this.#renderer.render(mapData);
      await this.#afterRender?.(mapData, operation);
      this.#renderer.setViewport(viewport);
      await this.#onGenerated(mapData, operation);

      return mapData;
    } catch (error) {
      await this.#onGenerationError(error, operation);
      return null;
    } finally {
      await this.#onComplete?.(operation);
    }
  }
}
