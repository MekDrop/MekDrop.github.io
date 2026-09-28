export class RecordingCanvasUnavailableError extends Error {
  constructor() {
    super("The game canvas is not available for recording.");
    /**
     *
     * @type {string}
     */
    this.name = "RecordingCanvasUnavailableError";
  }
}
