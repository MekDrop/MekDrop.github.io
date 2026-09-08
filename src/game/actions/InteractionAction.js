export class InteractionAction {
  #renderer;

  constructor(renderer) {
    this.#renderer = renderer;
  }

  interact() {
    return this.#renderer.interact();
  }
}
