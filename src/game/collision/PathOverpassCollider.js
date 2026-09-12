export class PathOverpassCollider {
  #centerX;
  #centerZ;
  #halfWidth;
  #halfDepth;
  #deckElevation;
  #undersideElevation;

  constructor({ overpass, cols, rows }) {
    const { col, row, width, depth } = overpass.crossing;
    this.#centerX = col + (width - 1) / 2 - (cols - 1) / 2;
    this.#centerZ = row + (depth - 1) / 2 - (rows - 1) / 2;
    this.#halfWidth = width / 2;
    this.#halfDepth = depth / 2;
    this.#deckElevation = overpass.deckElevation;
    this.#undersideElevation =
      overpass.deckElevation - (overpass.deckThickness ?? 0.24);
  }

  intersectsGroundFootprint(x, z, radius = 0) {
    return (
      Math.abs(x - this.#centerX) <= this.#halfWidth + radius &&
      Math.abs(z - this.#centerZ) <= this.#halfDepth + radius
    );
  }

  blocksMovementAt(x, z, radius, elevation, stepClearance) {
    if (!this.intersectsGroundFootprint(x, z, radius)) {
      return false;
    }
    return (
      elevation + stepClearance > this.#undersideElevation &&
      elevation < this.#deckElevation - stepClearance
    );
  }

  surfaceHeightAt(x, z, radius = 0) {
    return this.intersectsGroundFootprint(x, z, radius)
      ? this.#deckElevation
      : null;
  }

  ceilingHeightAt(x, z, radius = 0) {
    return this.intersectsGroundFootprint(x, z, radius)
      ? this.#undersideElevation
      : null;
  }

  isBelowDeckAt(x, z, elevation, radius = 0) {
    return (
      this.intersectsGroundFootprint(x, z, radius) &&
      elevation < this.#undersideElevation
    );
  }
}
