export class VegetationInteractionAction {
  #renderer;

  constructor(renderer) {
    this.#renderer = renderer;
  }

  interact() {
    return this.#renderer.interactWithVegetation();
  }
}
