export class CastleBasePlanInvalidError extends Error {
  /**
   * @param {string} planId
   * @param {string} field
   */
  constructor(planId, field) {
    super(`Castle base plan ${planId} has an invalid or unsupported field: ${field}.`);
    this.name = this.constructor.name;
  }
}
