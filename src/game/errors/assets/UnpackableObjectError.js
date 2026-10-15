/**
 * A contained object must expose finite rendered geometry to the packing solver.
 */
export class UnpackableObjectError extends Error {
  /**
   * @param {{name: string}} options
   */
  constructor({ name }) {
    super(`Cannot pack ${name}: the object has no finite rendered geometry.`);

    this.name = "UnpackableObjectError";
  }
}
