export class ToggleArrowsAction {
  #renderer;
  #onChange;

  constructor(renderer, onChange = () => {}) {
    this.#renderer = renderer;
    this.#onChange = onChange;
  }

  toggleArrows() {
    const visible = !this.#renderer.getArrowsVisible();
    this.#renderer.setArrowsVisible(visible);
    this.#onChange(visible);
  }
}
