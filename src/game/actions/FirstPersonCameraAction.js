export class FirstPersonCameraAction {
  #renderer;
  #heroMovement;
  #cameraPointer;
  #onChange;

  constructor(renderer, heroMovement, cameraPointer, onChange = () => {}) {
    this.#renderer = renderer;
    this.#heroMovement = heroMovement;
    this.#cameraPointer = cameraPointer;
    this.#onChange = onChange;
  }

  invoke() {
    const enabled = !this.#renderer.firstPersonCameraEnabled;
    this.#heroMovement.clear();
    this.#renderer.firstPersonCameraEnabled = enabled;
    if (enabled) {
      this.#cameraPointer.capture();
    } else {
      this.#cameraPointer.release();
    }
    this.#onChange(enabled);
  }
}
