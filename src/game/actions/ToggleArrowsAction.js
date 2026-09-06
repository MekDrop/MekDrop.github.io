export class ToggleArrowsAction {
  #renderer;
  #onChange;

  constructor(renderer, onChange = () => {}) {
    this.#renderer = renderer;
    this.#onChange = onChange;
  }

  toggleArrows() {
    const visible = !this.#renderer.arrowsVisible;
    this.#renderer.arrowsVisible = visible;
    this.#onChange(visible);
  }
}
