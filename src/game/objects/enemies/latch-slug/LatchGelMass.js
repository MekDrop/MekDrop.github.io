/**
 * Consumed mass becomes visible after the stretched skin has recoiled.
 */
export class LatchGelMass {
  /**
   * @type {number}
   */
  scoops = 0;
  /**
   * @type {number}
   */
  opacity = 0.82;

  /**
   * @param {import("./LatchSlug.js").LatchSlug} owner
   */
  constructor(owner) {
    this.owner = owner;
  }

  removeScoop() {
    this.scoops = Math.min(10, this.scoops + 1);
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || !this.owner.alive) {
      return;
    }
    if (this.owner.scoopGel?.active && this.owner.scoopGel.bug.scoop.time < 1.03) {
      return;
    }
    // Retain a readable yellow silhouette through the final living scoop.
    const target = 0.82 - 0.5 * Math.min(9, this.scoops) / 9;
    this.opacity += (target - this.opacity) * (1 - Math.exp(-dt * 9));
  }
}
