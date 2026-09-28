export class RecordingAudioUnavailableError extends Error {
  constructor() {
    super("The game audio output is not available for recording.");
    /**
     *
     * @type {string}
     */
    this.name = "RecordingAudioUnavailableError";
  }
}
