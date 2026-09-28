export class ZoomAction {
  /**
   *
   * @type {PlayCanvasRenderer}
   */
  #renderer;
  /**
   *
   * @type {HTMLElement}
   */
  #element;
  /**
   *
   * @type {{minimum: number, maximum: number, step: number}}
   */
  #settings;
  /**
   *
   * @type {number}
   */
  #factor;

  /**
   *
   * @param {PlayCanvasRenderer} renderer
   * @param {HTMLElement} element
   * @param {{enabled?: boolean, scale?: number, color?: number}} settings
   * @param {number} factor
   */
  constructor(renderer, element, settings, factor = settings?.factor) {
    /**
     *
     * @type {PlayCanvasRenderer}
     */
    this.#renderer = renderer;
    /**
     *
     * @type {HTMLElement}
     */
    this.#element = element;
    const configuredMin = settings?.min;
    const configuredMax = settings?.max;

    const resolvedFactor = Number.isFinite(factor) ? factor : 1.1;
    const min = Number.isFinite(configuredMin)
      ? configuredMin
      : 1;
    const max = Number.isFinite(configuredMax)
      ? configuredMax
      : 6;

    /**
     *
     * @type {{minimum: number, maximum: number, step: number}}
     */
    this.#settings = {
      min: Math.min(min, max),
      max: Math.max(min, max),
    };
    /**
     *
     * @type {number}
     */
    this.#factor = resolvedFactor > 0 ? resolvedFactor : 1;
  }

  /**
   *
   * @param {{x: number, y: number}} pivot
   */
  invoke(pivot = this.#viewportCenter()) {
    if (this.#renderer.inventoryVisible) {
      return;
    }
    if (this.#renderer.firstPersonCameraEnabled) {
      return;
    }
    const zoom = this.#clampZoom(this.#renderer.zoom * this.#factor);
    this.#renderer.zoomTo(zoom, pivot.x, pivot.y);
  }

  #viewportCenter() {
    if (!this.#element) {
      return { x: 0, y: 0 };
    }

    return {
      x: this.#element.clientWidth / 2,
      y: this.#element.clientHeight / 2,
    };
  }

  /**
   *
   * @param {number} zoom
   */
  #clampZoom(zoom) {
    return Math.max(this.#settings.min, Math.min(this.#settings.max, zoom));
  }
}
