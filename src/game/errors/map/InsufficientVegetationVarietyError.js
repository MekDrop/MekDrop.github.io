export class InsufficientVegetationVarietyError extends Error {
  constructor({ expected, actual }) {
    super(
      `Map validation failed: expected at least ${expected} vegetation variations but generated ${actual}.`,
    );
    this.name = this.constructor.name;
  }
}
