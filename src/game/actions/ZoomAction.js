export class ZoomAction {
  #renderer;
  #element;
  #settings;

  constructor(renderer, element, settings) {
    this.#renderer = renderer;
    this.#element = element;
    this.#settings = settings;
  }

  zoomIn(pivot = this.#viewportCenter()) {
    const zoom = Math.min(
      this.#settings.max,
      this.#renderer.zoom * this.#settings.factor,
    );
    this.#renderer.zoomTo(zoom, pivot.x, pivot.y);
  }

  zoomOut(pivot = this.#viewportCenter()) {
    const zoom = Math.max(
      this.#settings.min,
      this.#renderer.zoom / this.#settings.factor,
    );
    this.#renderer.zoomTo(zoom, pivot.x, pivot.y);
  }

  #viewportCenter() {
    return {
      x: this.#element.clientWidth / 2,
      y: this.#element.clientHeight / 2,
    };
  }
}
