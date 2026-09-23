import { ToggleRecordingAction } from "../../actions/ToggleRecordingAction.js";
import { GAME_RECORDING_STATE } from "../../enum/GameRecordingState.js";
import { GameRecorder } from "../../recording/GameRecorder.js";
import { reportGlobalException } from "../../../boot/runtime-errors.js";

const TOGGLE_RECORDING_BINDING = Object.freeze({
  keys: ["PrintScreen"],
  ctrlKey: true,
  allowRepeat: false,
});

export class GameCanvasRecordingPlugin {
  #context;
  #recorder = null;
  #state = GAME_RECORDING_STATE.IDLE;
  #stateListeners = new Set();
  #unregisterControlAction = null;

  constructor(context) {
    this.#context = context;
  }

  install() {
    const renderer = this.#context.renderer();
    this.#recorder = new GameRecorder({
      app: renderer.app,
      canvas: renderer.canvasElement,
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

  onStateChange(listener) {
    this.#stateListeners.add(listener);
    listener(this.#state);
    return () => {
      this.#stateListeners.delete(listener);
    };
  }

  destroy() {
    this.#unregisterControlAction?.();
    this.#unregisterControlAction = null;
    this.#recorder?.destroy();
    this.#recorder = null;
    this.#setState(GAME_RECORDING_STATE.IDLE);
    this.#stateListeners.clear();
  }

  #setState(state) {
    this.#state = state;
    for (const listener of this.#stateListeners) {
      listener(state);
    }
  }

  #reportError = (error) => {
    reportGlobalException(error, { context: "Game recording" });
  };
}
