/**
 * Capability-based frost effects. Friendly fire intentionally has no faction filter.
 */
export class FrostPuffCombat {
  /**
   * @param {import("./FrostPuff.js").FrostPuff} owner
   */
  constructor(owner) {
    this.owner = owner;
  }

  /**
   * Returns only actors with an actual status receiver; scenery is never a target.
   * @param {import("../shared/Enemy.js").EnemyActor} actor
   * @returns {boolean}
   */
  canChill(actor) {
    return actor !== this.owner && actor?.alive !== false && !actor?.isTower &&
      typeof actor?.applyStatus === "function";
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} actor
   * @param {boolean} freeze
   * @returns {boolean}
   */
  chill(actor, freeze = false) {
    if (!this.canChill(actor)) {
      return false;
    }
    const duration = freeze ? 1.4 : 2.8;
    const accepted = actor.applyStatus("slow", {
      duration,
      factor: freeze ? 0 : 0.45,
      source: this.owner,
    });
    if (freeze && accepted) {
      actor.applyStatus("stun", {
        duration,
        source: this.owner,
      });
    }
    return accepted;
  }

  /**
   * @returns {import("../shared/Enemy.js").EnemyActor|null}
   */
  get shotTarget() {
    const owner = this.owner;
    const targets = owner.actors.filter(this.#isShotTarget.bind(this));
    targets.sort(this.#compareTargets.bind(this));

    return targets[0] ?? null;
  }

  /**
   * @param {number} radius
   * @returns {number} Number of genuine accepted freeze effects.
   */
  burst(radius = 2.4) {
    let affected = 0;
    for (const actor of new Set(this.owner.actors)) {
      if (this.canChill(actor) && this.owner.distanceTo(actor) <= radius &&
        this.owner.hasLineOfSight(actor) && this.chill(actor, true)) {
        affected++;
      }
    }

    return affected;
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} actor
   * @returns {boolean}
   */
  #isShotTarget(actor) {
    return this.canChill(actor) && (actor.isDefender === true || actor.enemyType === "CinderImp") &&
      this.owner.distanceTo(actor) <= 4.5 && this.owner.hasLineOfSight(actor);
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} first
   * @param {import("../shared/Enemy.js").EnemyActor} second
   * @returns {number}
   */
  #compareTargets(first, second) {
    // The rivalry is Cinder Imp; Crown Crab receives only incidental friendly fire.
    const priority = Number(second.enemyType === "CinderImp") - Number(first.enemyType === "CinderImp");

    return priority || this.owner.distanceTo(first) - this.owner.distanceTo(second);
  }
}
