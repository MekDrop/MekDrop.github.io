export class CastleStairwellPlacementError extends Error {
  constructor() {
    super("Castle footprint cannot fit the spiral stairwell and terrace.");
    this.name = this.constructor.name;
  }
}
