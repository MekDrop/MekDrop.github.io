export class InteractionAction {
  #renderer;

  constructor(renderer) {
    this.#renderer = renderer;
  }

  invoke() {
    if (this.#renderer.inventoryVisible) {
      return false;
    }
    return this.interact();
  }

  interact() {
    return this.#renderer.interact();
  }
}
