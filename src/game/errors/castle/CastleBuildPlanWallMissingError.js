export class CastleBuildPlanWallMissingError extends Error {
  constructor() {
    super("Castle build plan is invalid: wall plan is missing.");
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
