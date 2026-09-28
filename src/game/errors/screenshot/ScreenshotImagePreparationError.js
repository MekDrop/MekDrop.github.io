export class ScreenshotImagePreparationError extends Error {
  constructor() {
    super("Could not prepare the screenshot for copying.");
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
