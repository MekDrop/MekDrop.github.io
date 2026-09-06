export class ZoomAction {
  #renderer;
  #element;
  #settings;

  constructor(renderer, element, settings) {
    this.#renderer = renderer;
    this.#element = element;
    const configuredFactor = settings?.factor;
    const configuredMin = settings?.min;
    const configuredMax = settings?.max;

    const factor = Number.isFinite(configuredFactor)
      ? configuredFactor
      : 1.1;
    const min = Number.isFinite(configuredMin)
      ? configuredMin
      : 1;
    const max = Number.isFinite(configuredMax)
      ? configuredMax
      : 6;

    this.#settings = {
      factor,
      min: Math.min(min, max),
      max: Math.max(min, max),
    };
  }

  zoomIn(pivot = this.#viewportCenter()) {
    const zoom = this.#clampZoom(this.#renderer.zoom * this.#settings.factor);
    this.#renderer.zoomTo(zoom, pivot.x, pivot.y);
  }

  zoomOut(pivot = this.#viewportCenter()) {
    const zoom = this.#clampZoom(this.#renderer.zoom / this.#settings.factor);
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
