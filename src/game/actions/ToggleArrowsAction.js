export class ToggleArrowsAction {
  #debugStore;
  #onChange;
  #canInvoke;

  constructor(debugStore, onChange = () => {}, canInvoke = () => true) {
    this.#debugStore = debugStore;
    this.#onChange = onChange;
    this.#canInvoke = canInvoke;
  }

  invoke() {
    if (!this.#canInvoke()) {
      return;
    }
    this.toggleArrows();
  }

  toggleArrows() {
    const visible = this.#debugStore.toggleAll();
    this.#onChange(visible);
  }
}
