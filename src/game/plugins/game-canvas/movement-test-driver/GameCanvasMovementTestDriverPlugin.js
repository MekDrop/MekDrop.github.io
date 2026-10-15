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
       * @param {{x:number,y:number,z:number}} position
       */
      teleport: (position) => this.#context.renderer().hero?.teleport(position),
      /**
       * @param {string} name
       */
      jointRotation: (name) => {
        const joint = this.#context.renderer().hero?.entity?.findByName(name);
        if (!joint) return null;
        const rotation = joint.getLocalRotation();
        return { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w };
      },
      /**
       * @param {string[]} names
       */
      animationPose: (names) => {
        const hero = this.#context.renderer().hero;
        const model = hero?.entity?.findByName("Hero model instance");
        const joints = {};
        for (const name of names) {
          const point = hero?.entity?.findByName(name)?.getPosition();
          if (point) joints[name] = { x: point.x, y: point.y, z: point.z };
        }
        return { clip: model?.anim?.baseLayer.activeState, time: model?.anim?.baseLayer.activeStateCurrentTime, joints };
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
      mapObjects: () => this.#context.renderer().authoredObjectDefinitions,
      royalCastles: () => this.#context.renderer().royalCastleStates,
      droppedInventoryItemCount: () =>
        this.#context.renderer().thrownInventoryItemCount,
      droppedInventoryItems: () =>
        this.#context.renderer().thrownInventoryItemStates,
      inventoryFullReactionVisible: () =>
        this.#context.renderer().inventoryFullReactionVisible,
      gameStatusHud: () => this.#context.renderer().gameStatusHudState,
      state: () => this.#context.renderer().heroState,
      isGameOver: () => this.#context.renderer().isGameOver(),
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
