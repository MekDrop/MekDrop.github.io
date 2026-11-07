/**
 * Scoops accumulate independently of affection; five trigger survival movement.
 */
export class LatchAnnoyance {
  /**
   * @type {number}
   */
  level = 0;
  /**
   * @type {boolean}
   */
  active = false;

  /**
   * @param {import("./LatchSlug.js").LatchSlug} owner
   */
  constructor(owner) {
    this.owner = owner;
  }

  /**
   * @param {import("../bell-bug/BellBug.js").BellBug} source
   * @returns {boolean}
   */
  scoop(source) {
    const owner = this.owner;
    if (!owner.alive || owner.carrier || owner.airborne || owner.gatewayArrival.active) {
      return false;
    }
    this.level = Math.min(5, this.level + 1);
    this.active = this.level >= 5;
    owner.affection.charge = Math.max(0, owner.affection.charge - 0.6);
    owner.affection.patRemaining = 0;
    owner.affection.happyRemaining = 0;
    owner.statuses.delete("affection");
    // Clamp the final portion to avoid floating-point health surviving scoop ten.
    owner.gelMass?.removeScoop();
    const portion = owner.maxHealth / 10;
    owner.receiveDamage(owner.health <= portion + 1e-8 ? owner.health : portion, source, "scoop");

    return true;
  }
}
