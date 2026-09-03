export class IsolatedGrassElevationError extends Error {
  constructor() {
    super(
      "Map validation failed: grass elevation changes appear as random isolated noise.",
    );
    this.name = this.constructor.name;
  }
}
