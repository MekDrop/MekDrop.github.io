export class ScreenshotEncodingError extends Error {
  constructor() {
    super("Could not encode the game screenshot.");
    this.name = this.constructor.name;
  }
}
