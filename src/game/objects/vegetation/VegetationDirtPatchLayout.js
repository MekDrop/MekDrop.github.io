const GRASS_HEIGHT_TOLERANCE = 0.08;

export class VegetationDirtPatchLayout {
  /**
   *
    * @type {number}
   */
  #x;
  /**
   *
    * @type {number}
   */
  #y;
  /**
   *
    * @type {number}
   */
  #z;
  /**
   *
    * @type {number}
   */
  #outline;
  /**
   *
    * @type {number}
   */
  #cosine;
  /**
   *
    * @type {number}
   */
  #sine;

  /**
   *
   * @param {{outline: Array<import("src/game/objects/ObjectTypes.js").Point3>, x: number, y: number, z: number, rotation: number}} options
   * @param {Array<import("src/game/objects/ObjectTypes.js").Point3>} options.outline
   * @param {number} options.x
   * @param {number} options.y
   * @param {number} options.z
   * @param {number} options.rotation
   */
  constructor({ outline, x, y, z, rotation = 0 }) {
    this.#x = x;
    this.#y = y;
    this.#z = z;
    this.#outline = outline.map(/**
     *
     * @param {{x: number, y: number, z: number}} point
     */
    (point) => ({ ...point }));
    const rotationRadians = (rotation * Math.PI) / 180;
    this.#cosine = Math.cos(rotationRadians);
    this.#sine = Math.sin(rotationRadians);
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} elevation
   */
  grassWeightAt(x, z, elevation) {
    if (Math.abs(elevation - this.#y) > GRASS_HEIGHT_TOLERANCE) {
      return 0;
    }
    const deltaX = x - this.#x;
    const deltaZ = z - this.#z;
    const localX = this.#cosine * deltaX - this.#sine * deltaZ;
    const localZ = this.#sine * deltaX + this.#cosine * deltaZ;
    let inside = false;
    for (
      let index = 0, previous = this.#outline.length - 1;
      index < this.#outline.length;
      previous = index, index += 1
    ) {
      const currentPoint = this.#outline[index];
      const previousPoint = this.#outline[previous];
      const crosses =
        currentPoint.z > localZ !== previousPoint.z > localZ &&
        localX <
          ((previousPoint.x - currentPoint.x) *
            (localZ - currentPoint.z)) /
            (previousPoint.z - currentPoint.z) +
            currentPoint.x;
      if (crosses) {
        inside = !inside;
      }
    }
    return inside ? 1 : 0;
  }
}
