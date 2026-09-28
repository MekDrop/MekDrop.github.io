export class CastleBuildPlanInteriorDepthInvalidError extends Error {
  constructor() {
    super("Castle build plan is invalid: interior depth is invalid.");
    /**
     *
     * @type {string}
     */
    this.name = this.constructor.name;
  }
}
