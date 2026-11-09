import { DestructibleVegetation } from "./DestructibleVegetation.js";

export class Bush extends DestructibleVegetation {
  /**
   *
   * @param {ConstructorParameters<typeof DestructibleVegetation>[0]} options
   */
  constructor(options) {
    super({
      ...options,
      kind: "bush",
    });
  }

  /**
   * One short burst burns only the currently exposed leafy level.
   * @param {number} height
   * @returns {object|null}
   */
  burnLevel(height) {
    if (!this.canInteract || Math.abs(this.describe().cutHeight - height) > 0.01) {
      return null;
    }
    const row = Math.max(...this.remainingVoxels.map(Bush.#row));

    return this.cutLevel(row);
  }

  /**
   * @param {{y:number}} voxel
   * @returns {number}
   */
  static #row(voxel) {
    return voxel.y;
  }
}
