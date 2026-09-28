export class GameCanvasMovementTestDriverPlugin {
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
       * @param {string} scenario
       */
      loadScenario: (scenario) => this.#loadScenario(scenario),
      /**
       *
       * @param {boolean} active
       */
      moveForward: (active = true) => {
        this.#context.renderer().hero?.setMovement(0, active ? -1 : 0);
      },
      /**
       *
       * @param {number} inputX
       * @param {number} inputY
       * @param {boolean} running
       */
      move: (inputX, inputY, running = false) => {
        this.#context.renderer().hero?.setMovement(inputX, inputY, running);
      },
      jump: () => {
        this.#context.renderer().hero?.jump();
      },
      /**
       *
       * @param {number} inputX
       * @param {number} inputY
       * @param {string} direction
       */
      dodge: (inputX, inputY, direction = "forward") =>
        this.#context.renderer().hero?.dodge(inputX, inputY, direction) ?? false,
      interact: () => this.#context.renderer().interact(),
      royalCastles: () => this.#context.renderer().royalCastleStates,
      droppedInventoryItemCount: () =>
        this.#context.renderer().thrownInventoryItemCount,
      droppedInventoryItems: () =>
        this.#context.renderer().thrownInventoryItemStates,
      inventoryFullReactionVisible: () =>
        this.#context.renderer().inventoryFullReactionVisible,
      gameStatusHud: () => this.#context.renderer().gameStatusHudState,
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

  /**
   *
   * @param {string} scenario
   */
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
