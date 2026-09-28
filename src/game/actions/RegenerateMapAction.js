import { INPUT_EVENT_TYPE } from "../enum/InputEventType.js";

export class RegenerateMapAction {
  /**
   *
   * @type {PlayCanvasRenderer}
   */
  #renderer;
  /**
   *
   * @type {() => import("src/game/GameContracts.js").GameMapData|Promise<import("src/game/GameContracts.js").GameMapData>}
   */
  #generateMap;
  /**
   *
   * @type {(mapData: import("src/game/GameContracts.js").GameMapData, operation: import("src/game/GameContracts.js").LifecycleOperation) => void|Promise<void>}
   */
  #onGenerated;
  /**
   *
   * @type {(error: Error, operation: import("src/game/GameContracts.js").LifecycleOperation) => void|Promise<void>}
   */
  #onGenerationError;
  /**
   *
   * @type {() => import("src/game/GameContracts.js").GameMapData|Promise<import("src/game/GameContracts.js").GameMapData>}
   */
  #beforeGeneration;
  /**
   *
   * @type {(mapData: import("src/game/GameContracts.js").GameMapData, operation: import("src/game/GameContracts.js").LifecycleOperation) => void|Promise<void>}
   */
  #beforeRender;
  /**
   *
   * @type {(mapData: import("src/game/GameContracts.js").GameMapData, operation: import("src/game/GameContracts.js").LifecycleOperation) => void|Promise<void>}
   */
  #afterRender;
  /**
   *
   * @type {(operation?: import("src/game/GameContracts.js").LifecycleOperation) => void|Promise<void>}
   */
  #onComplete;
  /**
   *
   * @type {(lifecycle: import("src/game/GameContracts.js").LifecycleOperation) => void}
   */
  #onLifecycle;

  /**
   *
   * @param {PlayCanvasRenderer} renderer
   * @param {() => import("src/game/GameContracts.js").GameMapData|Promise<import("src/game/GameContracts.js").GameMapData>} generateMap
   * @param {{onGenerated?: (mapData: import("src/game/GameContracts.js").GameMapData, operation: import("src/game/GameContracts.js").LifecycleOperation) => void|Promise<void>, onGenerationError?: (error: Error, operation: import("src/game/GameContracts.js").LifecycleOperation) => void|Promise<void>, beforeGeneration?: () => import("src/game/GameContracts.js").GameMapData|Promise<import("src/game/GameContracts.js").GameMapData>, beforeRender?: (mapData: import("src/game/GameContracts.js").GameMapData, operation: import("src/game/GameContracts.js").LifecycleOperation) => void|Promise<void>, afterRender?: (mapData: import("src/game/GameContracts.js").GameMapData, operation: import("src/game/GameContracts.js").LifecycleOperation) => void|Promise<void>, onComplete?: (operation?: import("src/game/GameContracts.js").LifecycleOperation) => void|Promise<void>, onLifecycle?: (lifecycle: import("src/game/GameContracts.js").LifecycleOperation) => void}} options
   * @param {(mapData: import("src/game/GameContracts.js").GameMapData, operation: import("src/game/GameContracts.js").LifecycleOperation) => void|Promise<void>} options.onGenerated
   * @param {(error: Error, operation: import("src/game/GameContracts.js").LifecycleOperation) => void|Promise<void>} options.onGenerationError
   * @param {() => import("src/game/GameContracts.js").GameMapData|Promise<import("src/game/GameContracts.js").GameMapData>} options.beforeGeneration
   * @param {(mapData: import("src/game/GameContracts.js").GameMapData, operation: import("src/game/GameContracts.js").LifecycleOperation) => void|Promise<void>} options.beforeRender
   * @param {(mapData: import("src/game/GameContracts.js").GameMapData, operation: import("src/game/GameContracts.js").LifecycleOperation) => void|Promise<void>} options.afterRender
   * @param {(operation?: import("src/game/GameContracts.js").LifecycleOperation) => void|Promise<void>} options.onComplete
   * @param {(lifecycle: import("src/game/GameContracts.js").LifecycleOperation) => void} options.onLifecycle
   */
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
    /**
     *
     * @type {PlayCanvasRenderer}
     */
    this.#renderer = renderer;
    /**
     *
     * @type {() => import("src/game/GameContracts.js").GameMapData|Promise<import("src/game/GameContracts.js").GameMapData>}
     */
    this.#generateMap = generateMap;
    /**
     *
     * @type {(mapData: import("src/game/GameContracts.js").GameMapData, operation: import("src/game/GameContracts.js").LifecycleOperation) => void|Promise<void>}
     */
    this.#onGenerated = onGenerated;
    /**
     *
     * @type {(error: Error, operation: import("src/game/GameContracts.js").LifecycleOperation) => void|Promise<void>}
     */
    this.#onGenerationError = onGenerationError;
    /**
     *
     * @type {() => import("src/game/GameContracts.js").GameMapData|Promise<import("src/game/GameContracts.js").GameMapData>}
     */
    this.#beforeGeneration = beforeGeneration;
    /**
     *
     * @type {(mapData: import("src/game/GameContracts.js").GameMapData, operation: import("src/game/GameContracts.js").LifecycleOperation) => void|Promise<void>}
     */
    this.#beforeRender = beforeRender;
    /**
     *
     * @type {(mapData: import("src/game/GameContracts.js").GameMapData, operation: import("src/game/GameContracts.js").LifecycleOperation) => void|Promise<void>}
     */
    this.#afterRender = afterRender;
    /**
     *
     * @type {(operation?: import("src/game/GameContracts.js").LifecycleOperation) => void|Promise<void>}
     */
    this.#onComplete = onComplete;
    /**
     *
     * @type {(lifecycle: import("src/game/GameContracts.js").LifecycleOperation) => void}
     */
    this.#onLifecycle = onLifecycle;
  }

  /**
   *
   * @param {Event} event
   */
  invoke(event) {
    if (event.type === INPUT_EVENT_TYPE.KEY_UP) {
      return null;
    }
    return this.regenerateMap();
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").ViewportRect} viewport
   */
  regenerateMap(viewport = this.#renderer.viewport) {
    const lifecycle = this.#runRegeneration(viewport);
    this.#onLifecycle(lifecycle);
    return lifecycle;
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").ViewportRect} viewport
   */
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
