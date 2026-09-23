export class GameCanvasCameraTestDriverPlugin {
  #context;
  #driver = null;

  constructor(context) {
    this.#context = context;
  }

  install() {
    this.#driver = {
      setZoom: (zoom) => {
        const renderer = this.#context.renderer();
        const container = this.#context.container();
        renderer.setViewport({ zoom: 1 });
        renderer.zoomTo(
          zoom,
          container.clientWidth / 2,
          container.clientHeight / 2,
        );
        return this.#state();
      },
      setRotation: (rotation) => {
        const renderer = this.#context.renderer();
        renderer.setViewport({
          ...renderer.viewport,
          rotation,
        });
        return this.#state();
      },
      panBy: (deltaX, deltaY) => {
        this.#context.renderer().panBy(deltaX, deltaY);
        return this.#state();
      },
      moveHero: (inputX, inputY, running = false) =>
        this.#context.renderer().setHeroMovement(inputX, inputY, running),
      returnToHero: () => this.#context.renderer().returnCameraToHero(),
      state: () => this.#state(),
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
      hero: renderer.heroState,
      royalCastles: renderer.royalCastleStates,
      panLimitsEnabled: renderer.panLimitsEnabled,
      viewport: renderer.viewport,
      visibility: renderer.mapVisibility,
    };
  }
}
