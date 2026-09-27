export class ToggleRecordingAction {
  #recording;
  #onError;

  constructor(recording, onError) {
    this.#recording = recording;
    this.#onError = onError;
  }

  invoke() {
    void this.#recording.toggleRecording().catch(this.#onError);
  }
}
