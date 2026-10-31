import { HERO_BUFF } from "../../../enum/HeroBuff.js";

/**
 * Three calm seconds establish affection; pats express happiness without skipping it.
 */
export class LatchAffection {
  /**
   * @param {import("./LatchSlug.js").LatchSlug} owner
   */
  constructor(owner) {
    this.owner = owner;
    this.companion = null;
    this.charge = 0;
    this.patRemaining = 0;
    this.happyRemaining = 0;
    this.refreshAfter = 0;
    this.lastPosition = null;
    this.contacts = 0;
    this.buffRemaining = 0;
  }

  /**
   * @returns {boolean}
   */
  get available() {
    const s = this.owner;

    return s.alive && !s.carrier && !s.airborne && !s.gatewayArrival.active
      && !s.statuses.has("stun") && !s.statuses.has("confused")
      && s.stateName !== "LatchPressState" && s.stateName !== "LatchLeapState";
  }

  /**
   * @returns {boolean}
   */
  get withinReach() {
    const s = this.owner, hero = s.runtime.getHero?.();

    return Boolean(this.available && s.stateName === "LatchDogState" && hero?.entity && hero.alive !== false && !hero.isDying
      && !hero.isIncapacitated && !hero.isUsingTool && !hero.isReacting
      && s.distanceTo(hero) <= 1.35 && Math.abs(s.targetPosition(hero).y - s.position.y) < 0.6
      && s.pack.canSee(hero));
  }

  /**
   * @returns {boolean}
   */
  get canPat() {
    return this.withinReach && this.patRemaining <= 0;
  }

  /**
   * @returns {boolean}
   */
  beginPat() {
    if (!this.canPat) {
      return false;
    }
    this.patRemaining = 1.1;
    this.contacts = 0;
    this.owner.stop();

    return true;
  }

  contact() {
    if (!this.withinReach || this.patRemaining <= 0) {
      return;
    }
    this.contacts += 1;
    this.happyRemaining = 1.5;
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) {
      return;
    }
    this.buffRemaining = Math.max(0, this.buffRemaining - dt);
    this.patRemaining = Math.max(0, this.patRemaining - dt);
    this.happyRemaining = Math.max(0, this.happyRemaining - dt);
    if (!this.available) {
      this.patRemaining = 0;
    }
    const s = this.owner, person = s.pack.leader;
    const p = person ? s.targetPosition(person) : null;
    const moved = p && this.lastPosition && this.companion === person
      && p.distance(this.lastPosition) > Math.max(0.002, dt * 0.35);
    const velocity = s.entity.rigidbody?.linearVelocity;
    const still = !velocity || Math.hypot(velocity.x, velocity.z) < 0.15;
    const calm = still && this.available && s.stateName === "LatchDogState" && person
      && person.alive !== false && s.distanceTo(person) <= 1.2 && !moved && s.pack.canSee(person);
    if (!calm || this.companion !== person) {
      this.charge = 0;
    }
    this.companion = person;
    this.lastPosition = p?.clone() ?? null;
    if (!calm) {
      return;
    }
    this.charge = Math.min(3, this.charge + dt);
    if (this.charge < 3) {
      return;
    }
    s.applyStatus("affection", {
      duration: 0.6,
      source: person,
    });
    this.refreshAfter -= dt;
    if (this.refreshAfter <= 0) {
      if (person.applyBuff?.(HERO_BUFF.SLIME_AFFECTION, { duration: 2 })) {
        this.buffRemaining = 2;
      }
      this.refreshAfter = 0.5;
    }
  }
}
