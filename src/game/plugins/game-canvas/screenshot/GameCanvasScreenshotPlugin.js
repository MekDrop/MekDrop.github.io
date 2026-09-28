import { CopyScreenshotAction } from "./actions/CopyScreenshotAction.js";

const COPY_SCREENSHOT_BINDING = Object.freeze({
  keys: ["KeyS"],
  ctrlKey: true,
  allowRepeat: false,
});

export class GameCanvasScreenshotPlugin {
  /**
   *
   * @type {import("src/game/GameContracts.js").GameCanvasPluginContext}
   */
  #context;
  /**
   *
   * @type {null}
   */
  #unregisterControlAction = null;

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
    this.#unregisterControlAction = this.#context.registerControlAction(
      "copyScreenshot",
      new CopyScreenshotAction(this.#context.renderer()),
      {
        binding: COPY_SCREENSHOT_BINDING,
        keydown: true,
      },
    );
  }

  destroy() {
    this.#unregisterControlAction?.();
    this.#unregisterControlAction = null;
  }
}
