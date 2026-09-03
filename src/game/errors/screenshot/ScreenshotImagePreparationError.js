export class ScreenshotImagePreparationError extends Error {
  constructor() {
    super("Could not prepare the screenshot for copying.");
    this.name = this.constructor.name;
  }
}
