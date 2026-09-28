export class CastleBuildPlanStyleMissingError extends Error {
  constructor() {
    super("Castle build plan is invalid: style is missing.");
    this.name = this.constructor.name;
  }
}
