export class GameCanvasMovementTestDriverPlugin {
  #context;
  #driver = null;

  constructor(context) {
    this.#context = context;
  }

  install() {
    this.#driver = {
      loadScenario: (scenario) => this.#loadScenario(scenario),
      moveForward: (active = true) => {
        this.#context.renderer().hero?.setMovement(0, active ? -1 : 0);
      },
      move: (inputX, inputY, running = false) => {
        this.#context.renderer().hero?.setMovement(inputX, inputY, running);
      },
      jump: () => {
        this.#context.renderer().hero?.jump();
      },
      dodge: (inputX, inputY, direction = "forward") =>
        this.#context.renderer().hero?.dodge(inputX, inputY, direction) ?? false,
      interact: () => this.#context.renderer().interact(),
      royalCastles: () => this.#context.renderer().royalCastleStates,
      royalTriggerPhysics: () =>
        this.#context.renderer().royalTriggerPhysicsState,
      droppedInventoryItemCount: () =>
        this.#context.renderer().thrownInventoryItemCount,
      inventoryFullReactionVisible: () =>
        this.#context.renderer().inventoryFullReactionVisible,
      state: () => this.#context.renderer().heroState,
    };
    this.#context.target.gameMovementTest = this.#driver;
  }

  destroy() {
    if (this.#context.target.gameMovementTest === this.#driver) {
      delete this.#context.target.gameMovementTest;
    }
    this.#driver = null;
  }

  async #loadScenario(scenario) {
    const mapName = scenario.startsWith("test_")
      ? scenario
      : `test_${scenario}`;
    const route = this.#context.route();
    const reloadCurrentRoute =
      route.name === "map" && route.params.mapName === mapName;

    await this.#context.router.push(this.#context.mapRouteLocation(mapName));
    await this.#context.nextTick();
    if (reloadCurrentRoute) {
      this.#context.setMapRouteLoadPromise(
        this.#context.loadMapRoute(mapName),
      );
    }
    await this.#context.mapRouteLoadPromise();
    return this.#context.renderer().heroState;
  }
}
