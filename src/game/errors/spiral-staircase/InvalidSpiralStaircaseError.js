/**
 * Invalid staircase endpoint elevations.
 */
export class InvalidSpiralStaircaseError extends Error {
  /**
   * @param {{id: string}} definition
   */
  constructor(definition) {
    super(`Spiral staircase ${definition.id} requires finite Z1 < Z2 and a rise of at most 64.`);
    this.name = "InvalidSpiralStaircaseError";
  }
}
