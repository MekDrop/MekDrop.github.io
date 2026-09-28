export class FirstPersonCameraAction {
  /**
   *
   * @type {PlayCanvasRenderer}
   */
  #renderer;
  /**
   *
   * @type {import("src/game/GameContracts.js").HeroMovementContract}
   */
  #heroMovement;
  /**
   *
   * @type {import("src/game/GameContracts.js").CameraPointer}
   */
  #cameraPointer;
  /**
   *
   * @type {(value: boolean|number|string|null) => void}
   */
  #onChange;

  /**
   *
   * @param {PlayCanvasRenderer} renderer
   * @param {{moving: boolean, direction?: pc.Vec3, speed?: number}} heroMovement
   * @param {import("src/game/GameContracts.js").CameraPointer} cameraPointer
   * @param {(value: boolean|number|(value: boolean|number|string|null) => void|null) => void} onChange
   */
  constructor(renderer, heroMovement, cameraPointer, onChange = () => {}) {
    /**
     *
     * @type {PlayCanvasRenderer}
     */
    this.#renderer = renderer;
    /**
     *
     * @type {import("src/game/GameContracts.js").HeroMovementContract}
     */
    this.#heroMovement = heroMovement;
    /**
     *
     * @type {import("src/game/GameContracts.js").CameraPointer}
     */
    this.#cameraPointer = cameraPointer;
    /**
     *
     * @type {(value: boolean|number|string|null) => void}
     */
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
