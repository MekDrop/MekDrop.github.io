export class ScreenshotEncodingError extends Error {
  constructor() {
    super("Could not encode the game screenshot.");
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
