export class CastleBuildPlanStyleMissingError extends Error {
  constructor() {
    super("Castle build plan is invalid: style is missing.");
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
