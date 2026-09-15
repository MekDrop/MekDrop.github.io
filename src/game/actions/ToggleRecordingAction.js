export class ToggleRecordingAction {
  #renderer;
  #onError;

  constructor(renderer, onError) {
    this.#renderer = renderer;
    this.#onError = onError;
  }

  invoke() {
    void this.#renderer.toggleRecording().catch(this.#onError);
  }
}
