export class RotateViewAction {
  #renderer;
  #onChange;

  constructor(renderer, onChange = () => {}) {
    this.#renderer = renderer;
    this.#onChange = onChange;
  }

  invoke() {
    if (this.#renderer.inventoryVisible) {
      return this.#renderer.rotation;
    }
    return this.rotateAnticlockwise();
  }

  rotateAnticlockwise() {
    return this.rotateBy(-1);
  }

  rotateClockwise() {
    return this.rotateBy(1);
  }

  rotateBy(quarterTurns) {
    const rotation = this.#renderer.rotateBy(quarterTurns);
    this.#onChange(rotation);
    return rotation;
  }
}
