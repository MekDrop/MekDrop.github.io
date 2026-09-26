export class FirstPersonCameraAction {
  #renderer;
  #heroMovement;
  #onChange;

  constructor(renderer, heroMovement, onChange = () => {}) {
    this.#renderer = renderer;
    this.#heroMovement = heroMovement;
    this.#onChange = onChange;
  }

  invoke() {
    const enabled = !this.#renderer.firstPersonCameraEnabled;
    this.#heroMovement.clear();
    this.#renderer.firstPersonCameraEnabled = enabled;
    if (!enabled && document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    this.#onChange(enabled);
  }
}
