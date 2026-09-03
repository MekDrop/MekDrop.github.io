export class InsufficientLayoutVarietyError extends Error {
  constructor() {
    super(
      "Map validation failed: regeneration always keeps the same island shape or castle position.",
    );
    this.name = this.constructor.name;
  }
}
