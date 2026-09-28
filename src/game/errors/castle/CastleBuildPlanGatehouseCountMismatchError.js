export class CastleBuildPlanGatehouseCountMismatchError extends Error {
  constructor() {
    super("Castle build plan is invalid: gatehouse count does not match doors.");
    this.name = this.constructor.name;
  }
}
