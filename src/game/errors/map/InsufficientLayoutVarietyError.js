export class InsufficientLayoutVarietyError extends Error {
  constructor() {
    super(
      "Map validation failed: regeneration always keeps the same island shape or castle position.",
    );
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
