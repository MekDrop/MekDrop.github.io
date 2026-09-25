export class FreeCameraAction {
  #renderer;
  #heroMovement;
  #onChange;

  constructor(renderer, heroMovement, onChange = () => {}) {
    this.#renderer = renderer;
    this.#heroMovement = heroMovement;
    this.#onChange = onChange;
  }

  invoke() {
    const enabled = !this.#renderer.freeCameraEnabled;
    if (enabled) {
      this.#heroMovement.clear();
    }
    this.#renderer.freeCameraEnabled = enabled;
    this.#onChange(enabled);
  }
}
