import { reportGlobalException } from "../../../../boot/runtime-errors.js";
import { GAME_RECORDING_STATE } from "../../../enum/GameRecordingState.js";
import { ToggleRecordingAction } from "./actions/ToggleRecordingAction.js";
import { GameRecorder } from "./recording/GameRecorder.js";
import "./recording.scss";

const TOGGLE_RECORDING_BINDING = Object.freeze({
  keys: ["PrintScreen"],
  ctrlKey: true,
  allowRepeat: false,
});

export class GameCanvasRecordingPlugin {
  /**
   *
   * @type {import("src/game/GameContracts.js").GameCanvasPluginContext}
   */
  #context;
  /**
   *
   * @type {Array}
   */
  #messages;
  /**
   *
   * @type {null}
   */
  #recorder = null;
  /**
   *
   * @type {string}
   */
  #state = GAME_RECORDING_STATE.IDLE;
  /**
   *
   * @type {null}
   */
  #statusElement = null;
  /**
   *
   * @type {null}
   */
  #unregisterControlAction = null;

  /**
   *
   * @param {import("src/game/GameContracts.js").GameCanvasPluginContext} context
   * @param {{messages: Array}} options
   * @param {Array} options.messages
   */
  constructor(context, { messages }) {
    /**
     *
     * @type {import("src/game/GameContracts.js").GameCanvasPluginContext}
     */
    this.#context = context;
    /**
     *
     * @type {Array}
     */
    this.#messages = messages;
  }

  install() {
    const renderer = this.#context.renderer();
    this.#statusElement = this.#context.target.document.createElement("span");
    this.#statusElement.className = "q-sr-only";
    this.#statusElement.setAttribute("role", "status");
    this.#statusElement.setAttribute("aria-live", "polite");
    this.#context.container().append(this.#statusElement);
    this.#syncPresentation();
    this.#recorder = new GameRecorder({
      app: renderer.app,
      canvas: renderer.canvasElement,
      /**
       *
       * @param {import("src/game/GameContracts.js").StoreContract} state
       */
      onStateChange: (state) => this.#setState(state),
      onError: this.#reportError,
    });
    this.#unregisterControlAction = this.#context.registerControlAction(
      "toggleRecording",
      new ToggleRecordingAction(this, this.#reportError),
      {
        binding: TOGGLE_RECORDING_BINDING,
        keyup: true,
        consumeKeydown: true,
      },
    );
  }

  async toggleRecording() {
    await this.#recorder?.toggle();
  }

  get state() {
    return this.#state;
  }

  destroy() {
    this.#unregisterControlAction?.();
    this.#unregisterControlAction = null;
    this.#recorder?.destroy();
    this.#recorder = null;
    this.#setState(GAME_RECORDING_STATE.IDLE);
    this.#statusElement?.remove();
    this.#statusElement = null;
    const container = this.#context.container();
    container?.classList.remove("background-canvas--recording");
    if (container) {
      delete container.dataset.recordingState;
    }
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").StoreContract} state
   */
  #setState(state) {
    this.#state = state;
    this.#syncPresentation();
  }

  #syncPresentation() {
    const container = this.#context.container();
    if (!container) {
      return;
    }
    container.dataset.recordingState = this.#state;
    container.classList.toggle(
      "background-canvas--recording",
      this.#state === GAME_RECORDING_STATE.RECORDING,
    );
    if (this.#statusElement) {
      this.#statusElement.textContent =
        this.#state === GAME_RECORDING_STATE.RECORDING
          ? this.#messages.active
          : "";
    }
  }

  /**
   *
   * @param {Error} error
   * @type {(error: Error) => void}
   */
  #reportError = (error) => {
    reportGlobalException(error, { context: "Game recording" });
  };
}
