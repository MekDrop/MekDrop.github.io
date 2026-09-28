export class PathOverpassCollider {
  /**
   *
   * @type {number}
   */
  #centerX;
  /**
   *
   * @type {number}
   */
  #centerZ;
  /**
   *
   * @type {number}
   */
  #halfWidth;
  /**
   *
   * @type {number}
   */
  #halfDepth;
  /**
   *
   * @type {number}
   */
  #deckElevation;
  /**
   *
   * @type {number}
   */
  #undersideElevation;

  /**
   *
   * @param {{overpass: Array, cols: number[], rows: number[]}} options
   * @param {Array} options.overpass
   * @param {number[]} options.cols
   * @param {number[]} options.rows
   */
  constructor({ overpass, cols, rows }) {
    const { col, row, width, depth } = overpass.crossing;
    /**
     *
     * @type {number}
     */
    this.#centerX = col + (width - 1) / 2 - (cols - 1) / 2;
    /**
     *
     * @type {number}
     */
    this.#centerZ = row + (depth - 1) / 2 - (rows - 1) / 2;
    /**
     *
     * @type {number}
     */
    this.#halfWidth = width / 2;
    /**
     *
     * @type {number}
     */
    this.#halfDepth = depth / 2;
    /**
     *
     * @type {number}
     */
    this.#deckElevation = overpass.deckElevation;
    /**
     *
     * @type {number}
     */
    this.#undersideElevation =
      overpass.deckElevation - (overpass.deckThickness ?? 0.24);
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   */
  intersectsGroundFootprint(x, z, radius = 0) {
    return (
      Math.abs(x - this.#centerX) <= this.#halfWidth + radius &&
      Math.abs(z - this.#centerZ) <= this.#halfDepth + radius
    );
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   * @param {number} elevation
   * @param {number} stepClearance
   */
  blocksMovementAt(x, z, radius, elevation, stepClearance) {
    if (!this.intersectsGroundFootprint(x, z, radius)) {
      return false;
    }
    return (
      elevation + stepClearance > this.#undersideElevation &&
      elevation < this.#deckElevation - stepClearance
    );
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   */
  surfaceHeightAt(x, z, radius = 0) {
    return this.intersectsGroundFootprint(x, z, radius)
      ? this.#deckElevation
      : null;
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   */
  ceilingHeightAt(x, z, radius = 0) {
    return this.intersectsGroundFootprint(x, z, radius)
      ? this.#undersideElevation
      : null;
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} elevation
   * @param {number} radius
   */
  isBelowDeckAt(x, z, elevation, radius = 0) {
    return (
      this.intersectsGroundFootprint(x, z, radius) &&
      elevation < this.#undersideElevation
    );
  }
}
