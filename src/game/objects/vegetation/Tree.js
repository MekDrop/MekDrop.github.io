import { DestructibleVegetation } from "./DestructibleVegetation.js";

export class Tree extends DestructibleVegetation {
  /**
   * @type {number}
   */
  #hits = 0;
  /**
   * @type {number}
   */
  #cutRow;
  /**
   * @type {number}
   */
  #voxelSize;
  /**
   * @type {boolean}
   */
  #felled = false;
  /**
   * @type {boolean}
   */
  #swingHit = false;
  /**
   *
   * @param {ConstructorParameters<typeof DestructibleVegetation>[0]} options
   */
  constructor(options) {
    super({
      ...options,
      kind: "tree",
    });

    this.#voxelSize = options.voxelSize ?? 0.25;
    const trunk = options.collisionRows.slice().sort(/**
     *
     * @param {{y:number}} left
     * @param {{y:number}} right
     */
      (left, right) => left.y - right.y);
    let highest = 0;
    for (const row of trunk) {
      if (!Tree.#isTrunkRow(row)) {
        break;
      }
      highest = row.y;
    }
    this.#cutRow = Math.max(1, Math.floor(highest / 2));
  }

  /**
   * @returns {ReturnType<DestructibleVegetation["describe"]>}
   */
  describe() {
    return {
      ...super.describe(),
      cutHeight: (this.#cutRow + 0.5) * this.#voxelSize,
      verticalCut: this.#felled,
      felled: this.#felled,
      health: this.#felled ? this.remainingVoxels.length : 3 - this.#hits,
      maxHealth: this.#felled ? this.remainingVoxels.length : 3,
    };
  }

  /**
   * @param {{x:number,z:number}} position
   * @returns {{x:number,y:number,z:number,yaw:number}}
   */
  cuttingTargetFrom(position) {
    this.#swingHit = false;
    if (this.#felled) {
      this.#cutRow = Math.max(...this.remainingVoxels.map(Tree.#rowHeight));
    }
    return super.cuttingTargetFrom(position, this.#cutRow);
  }

  /**
   * @param {import("playcanvas").Vec3[]} previous
   * @param {import("playcanvas").Vec3[]} current
   * @param {number} cutHeight
   * @returns {object|null}
   */
  cutSweep(previous, current, cutHeight) {
    if (!this.canInteract || this.#swingHit ||
      Math.abs(cutHeight - this.describe().cutHeight) > 0.01 ||
      !this.touchesCutRow(previous, current, this.#cutRow)) {
      return null;
    }
    this.#swingHit = true;
    if (this.#felled) {
      return this.cutLevel(this.#cutRow);
    }
    this.#hits += 1;
    if (this.#hits < 3) {
      return {
        ...this.describe(),
        destroyed: false,
      };
    }
    this.#felled = true;

    return {
      ...this.cutLevel(this.#cutRow, true),
      felled: true,
    };
  }

  /**
   * A downward strike clears one remaining stump section at its impact event.
   * @returns {object|null}
   */
  cutVertical() {
    if (!this.#felled || !this.canInteract || this.#swingHit) {
      return null;
    }
    this.#swingHit = true;

    return this.cutLevel(this.#cutRow);
  }

  /**
   * @param {{y:number,cells:number[][]}} row
   * @returns {boolean}
   */
  static #isTrunkRow(row) {
    return row.cells.length === 1 && row.cells[0][0] === 0 && row.cells[0][1] === 0;
  }

  /**
   * @param {{y:number}} row
   * @returns {number}
   */
  static #rowHeight(row) {
    return row.y;
  }
}
