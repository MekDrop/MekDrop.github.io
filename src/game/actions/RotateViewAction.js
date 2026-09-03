export class RotateViewAction {
  #renderer;
  #onChange;

  constructor(renderer, onChange = () => {}) {
    this.#renderer = renderer;
    this.#onChange = onChange;
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
