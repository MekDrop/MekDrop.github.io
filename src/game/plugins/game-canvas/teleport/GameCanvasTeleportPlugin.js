export class GameCanvasTeleportPlugin {
  /**
   * @type {import("src/game/GameContracts.js").GameCanvasPluginContext}
   */
  #context;

  /**
   * @type {(() => void)|null}
   */
  #unregisterControlAction = null;

  /**
   * @param {import("src/game/GameContracts.js").GameCanvasPluginContext} context
   */
  constructor(context) {
    this.#context = context;
  }

  install() {
    this.#unregisterControlAction = this.#context.registerControlAction(
      "teleportHero",
      {
        /**
         * @param {MouseEvent} event
         */
        invoke: (event) => {
          if (event.button !== 0 || !(import.meta.env?.DEV || this.#context.debugStore.hasAny)) {
            return false;
          }
          return this.#context.renderer().teleportHeroAtPointer(event);
        },
      },
      { doubleClick: true },
    );
  }

  destroy() {
    this.#unregisterControlAction?.();
    this.#unregisterControlAction = null;
  }
}
