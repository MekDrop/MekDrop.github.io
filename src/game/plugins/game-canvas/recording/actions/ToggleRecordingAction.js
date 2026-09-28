export class ToggleRecordingAction {
  /**
   *
   * @type {GameCanvasRecordingPlugin}
   */
  #recording;
  /**
   *
   * @type {(error: Error) => void}
   */
  #onError;

  /**
   *
   * @param {{blob: Blob, duration: number, mimeType: string}} recording
   * @param {(error: Error) => void} onError
   */
  constructor(recording, onError) {
    /**
     *
     * @type {GameCanvasRecordingPlugin}
     */
    this.#recording = recording;
    /**
     *
     * @type {(error: Error) => void}
     */
    this.#onError = onError;
  }

  invoke() {
    void this.#recording.toggleRecording().catch(this.#onError);
  }
}
