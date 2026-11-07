import { HERO_BUFF } from "../../../enum/HeroBuff.js";

const SOCIAL_DISTANCE = 1.6;

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
  get nearCompanion() {
    const owner = this.owner;
    const person = owner.pack.leader ?? owner.pack.resolve?.();

    return Boolean(this.available && this.#nearHuman(person) && owner.pack.canSee(person)
      && (owner.nearbyDoor?.openAmount ?? 1) > 0.001
      && !owner.canCloseCompanionGap?.(person));
  }

  /**
   * @returns {boolean}
   */
  get settling() {
    if (this.nearCompanion) {
      return true;
    }
    const relay = this.#relay();

    return Boolean(relay && !this.owner.canApproachCompanion?.(relay.person));
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor|null} person
   * @returns {boolean}
   */
  #nearHuman(person) {
    const owner = this.owner;

    return Boolean(owner.alive && person && person.alive !== false && !person.isDying
      && owner.distanceTo(person) <= SOCIAL_DISTANCE
      && Math.abs(owner.targetPosition(person).y - owner.position.y) < 0.6);
  }

  /**
   * @returns {import("../shared/Enemy.js").EnemyActor|null}
   */
  get approachCompanion() {
    const relay = this.#relay();

    return relay && this.owner.canApproachCompanion?.(relay.person) ? relay.person : null;
  }

  /**
   * Find a live chain back to a human rather than letting affectionate slugs
   * sustain one another forever after their human leaves.
   * @returns {{person: import("../shared/Enemy.js").EnemyActor, rate: number}|null}
   */
  #relay() {
    const owner = this.owner;
    if (!this.available) {
      return null;
    }
    const human = owner.pack.leader;
    if (this.#nearHuman(human)) {
      return null;
    }
    const actors = owner.runtime?.objects?.getMatching?.(LatchAffection.#isSocial) ?? owner.actors ?? [];
    const visited = new Set([owner]);
    const queue = [{
      slug: owner,
      depth: 0,
    }];
    for (let index = 0; index < queue.length; index++) {
      const { slug, depth } = queue[index];
      if (depth > 0) {
        const person = slug.affection.companion;
        if (slug.affection.#nearHuman(person)) {
          return {
            person,
            rate: 0.5 ** depth,
          };
        }
      }
      for (const actor of actors) {
        if (visited.has(actor) || !(actor.affection instanceof LatchAffection)
          || !actor.affection.available || !actor.statuses.has("affection")
          || slug.distanceTo(actor) > 1.35 || Math.abs(actor.position.y - slug.position.y) >= 0.6
          || !slug.pack.canSee(actor)) {
          continue;
        }
        visited.add(actor);
        queue.push({
          slug: actor,
          depth: depth + 1,
        });
      }
    }

    return null;
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor & {affection?: LatchAffection}} actor
   * @returns {boolean}
   */
  static #isSocial(actor) {
    return actor.affection instanceof LatchAffection;
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
    const relay = this.#relay();
    if (relay && !this.owner.canApproachCompanion?.(relay.person)) {
      if (this.companion !== relay.person) {
        this.charge = 0;
      }
      this.companion = relay.person;
      this.charge = Math.min(3, this.charge + dt * relay.rate);
      this.owner.stop();
      if (this.charge >= 3) {
        this.owner.applyStatus("affection", {
          duration: 0.6,
          source: relay.person,
        });
      }

      return;
    }
    const s = this.owner, person = s.pack.leader;
    const p = person ? s.targetPosition(person) : null;
    const moved = p && this.lastPosition && this.companion === person
      && p.distance(this.lastPosition) > Math.max(0.002, dt * 0.35);
    const velocity = s.entity.rigidbody?.linearVelocity;
    const still = !velocity || Math.hypot(velocity.x, velocity.z) < 0.15;
    const nearby = this.#nearHuman(person);
    const established = (this.charge >= 3 && this.companion === person)
      || s.statuses.has("affection");
    const calm = nearby && this.available && s.stateName === "LatchDogState"
      && still && !moved && s.pack.canSee(person);
    // Proximity keeps earned affection alive; its grace period runs only after separation.
    const maintain = nearby && established;
    if ((!calm && !maintain) || this.companion !== person) {
      this.charge = 0;
    }
    this.companion = person;
    this.lastPosition = p?.clone() ?? null;
    if (!calm && !maintain) {
      return;
    }
    this.charge = maintain ? 3 : Math.min(3, this.charge + dt);
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
