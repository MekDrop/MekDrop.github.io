export class CastleBuildPlanWallMissingError extends Error {
  constructor() {
    super("Castle build plan is invalid: wall plan is missing.");
    this.name = this.constructor.name;
  }
}
