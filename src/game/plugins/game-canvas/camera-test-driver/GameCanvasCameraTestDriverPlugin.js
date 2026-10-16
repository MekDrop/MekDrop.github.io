export class GameCanvasCameraTestDriverPlugin {
  /**
   *
   * @type {import("src/game/GameContracts.js").GameCanvasPluginContext}
   */
  #context;
  /**
   *
   * @type {null}
   */
  #driver = null;

  /**
   *
   * @param {import("src/game/GameContracts.js").GameCanvasPluginContext} context
   */
  constructor(context) {
    /**
     *
     * @type {import("src/game/GameContracts.js").GameCanvasPluginContext}
     */
    this.#context = context;
  }

  install() {
    this.#driver = {
      /**
       *
       * @param {number} zoom
       */
      setZoom: this.#setZoom.bind(this),
      /**
       *
       * @param {pc.Vec3} rotation
       */
      setRotation: this.#setRotation.bind(this),
      /**
       *
       * @param {number} deltaX
       * @param {number} deltaY
       */
      panBy: this.#panBy.bind(this),
      /**
       *
       * @param {number} yawDegrees
       * @param {number} pitchDegrees
       */
      lookFirstPersonBy: this.#lookFirstPersonBy.bind(this),
      /**
       *
       * @param {number} inputX
       * @param {number} inputY
       * @param {boolean} running
       */
      moveHero: this.#moveHero.bind(this),
      returnToHero: this.#returnToHero.bind(this),
      /**
       * @param {boolean} enabled
       */
      firstPerson: this.#firstPerson.bind(this),
      state: this.#state2.bind(this),
    };
    this.#context.target.gameCameraTest = this.#driver;
  }

  destroy() {
    if (this.#context.target.gameCameraTest === this.#driver) {
      delete this.#context.target.gameCameraTest;
    }
    this.#driver = null;
  }

  #state() {
    const renderer = this.#context.renderer();

    return {
      cameraReturningToHero: renderer.cameraReturningToHero,
      firstPersonCameraEnabled: renderer.firstPersonCameraEnabled,
      firstPersonCamera: renderer.firstPersonCameraState,
      gameStatusHud: renderer.gameStatusHudState,
      hero: renderer.heroState,
      royalCastles: renderer.royalCastleStates,
      panLimitsEnabled: renderer.panLimitsEnabled,
      viewport: renderer.viewport,
      visibility: renderer.mapVisibility,
    };
  }

  /**
   *
   * @param {number} zoom
   */
  #setZoom(zoom) {
    const renderer = this.#context.renderer();
    const container = this.#context.container();
    renderer.setViewport({ zoom: 1 });
    renderer.zoomTo(
      zoom,
      container.clientWidth / 2,
      container.clientHeight / 2,
    );

    return this.#state();
  }

  /**
   *
   * @param {pc.Vec3} rotation
   */
  #setRotation(rotation) {
    const renderer = this.#context.renderer();
    renderer.setViewport({
      ...renderer.viewport,
      rotation,
    });

    return this.#state();
  }

  /**
   *
   * @param {number} deltaX
   * @param {number} deltaY
   */
  #panBy(deltaX, deltaY) {
    this.#context.renderer().panBy(deltaX, deltaY);

    return this.#state();
  }

  /**
   *
   * @param {number} yawDegrees
   * @param {number} pitchDegrees
   */
  #lookFirstPersonBy(yawDegrees, pitchDegrees) {
    this.#context.renderer().lookFirstPersonBy(yawDegrees, pitchDegrees);

    return this.#state();
  }

  /**
   *
   * @param {number} inputX
   * @param {number} inputY
   * @param {boolean} running
   */
  #moveHero(inputX, inputY, running = false) {
    return this.#context.renderer().hero?.setMovement(inputX, inputY, running);
  }

  #returnToHero() {
    return this.#context.renderer().returnCameraToHero();
  }

  /**
   * @param {boolean} enabled
   */
  #firstPerson(enabled) {
    this.#context.renderer().firstPersonCameraEnabled = enabled;

    return this.#state();
  }

  #state2() {
    return this.#state();
  }
}
