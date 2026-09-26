export class FirstPersonLookAction {
  #renderer;
  #degreesPerPixel;

  constructor(renderer, { degreesPerPixel }) {
    this.#renderer = renderer;
    this.#degreesPerPixel = Number.isFinite(degreesPerPixel)
      ? degreesPerPixel
      : 0.12;
  }

  get available() {
    return this.#renderer.firstPersonCameraEnabled;
  }

  invoke(event) {
    if (!this.available) {
      return;
    }
    this.#renderer.lookFirstPersonBy(
      event.movementX * this.#degreesPerPixel,
      event.movementY * this.#degreesPerPixel,
    );
  }
}
