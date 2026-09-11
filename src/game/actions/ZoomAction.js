export class ZoomAction {
  #renderer;
  #element;
  #settings;
  #factor;

  constructor(renderer, element, settings, factor = settings?.factor) {
    this.#renderer = renderer;
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

    this.#settings = {
      min: Math.min(min, max),
      max: Math.max(min, max),
    };
    this.#factor = resolvedFactor > 0 ? resolvedFactor : 1;
  }

  invoke(pivot = this.#viewportCenter()) {
    if (this.#renderer.inventoryVisible) {
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

  #clampZoom(zoom) {
    return Math.max(this.#settings.min, Math.min(this.#settings.max, zoom));
  }
}
