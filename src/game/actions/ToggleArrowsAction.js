export class ToggleArrowsAction {
  #debugStore;
  #onChange;

  constructor(debugStore, onChange = () => {}) {
    this.#debugStore = debugStore;
    this.#onChange = onChange;
  }

  toggleArrows() {
    const visible = this.#debugStore.toggleAll();
    this.#onChange(visible);
  }
}
