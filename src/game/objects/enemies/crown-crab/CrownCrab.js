import { Enemy } from "../shared/Enemy.js";
import { CrownCrabPursueState } from "./states/CrownCrabPursueState.js";
import { CrownCrabClawState } from "./states/CrownCrabClawState.js";
import { CrownCrabAngryState } from "./states/CrownCrabAngryState.js";
import { CrownCrabStunnedState } from "./states/CrownCrabStunnedState.js";
import { CrownCrabCarriedState } from "./states/CrownCrabCarriedState.js";
import { CrownCrabAirborneState } from "./states/CrownCrabAirborneState.js";
import { CrownCrabLandingState } from "./states/CrownCrabLandingState.js";
import { CrownCrabDeathState } from "./states/CrownCrabDeathState.js";

/**
 * Crown Crab behavior. Deliberately unregistered until the Tripo asset is ready.
 * Animation requests are retained for the future authored-model playback adapter.
 */
export class CrownCrab extends Enemy {
  /**
   * @type {Enemy|null}
   */
  revengeTarget = null;
  /**
   * @type {Enemy|null}
   */
  angerTarget = null;
  /**
   * @type {Enemy|null}
   */
  attackTarget = null;
  /**
   * @type {string}
   */
  requestedAnimation = "idle";
  /**
   * @type {number}
   */
  duelCooldownUntil = 0;
  /**
   * @type {number}
   */
  warningUntil = 0;

  /**
   * @param {import("../../ObjectTypes.js").MapObjectOptions} options
   */
  constructor(options) {
    super(options);

    this.radius = 0.55;
    this.height = 0.9;
    this.bellImmune = true;
    const states = [
      new CrownCrabPursueState(),
      new CrownCrabClawState(),
      new CrownCrabAngryState(),
      new CrownCrabStunnedState(),
      new CrownCrabCarriedState(),
      new CrownCrabAirborneState(),
      new CrownCrabLandingState(),
      new CrownCrabDeathState(),
    ];
    for (const state of states) {
      this.behavior.add(state.constructor.name, state);
    }
    this.behavior.changeTo(CrownCrabPursueState.name);
  }

  /**
   * @returns {Enemy|null}
   */
  get pursuitTarget() {
    if (this.grudgesSuppressed) {
      return this.resolveRoyalTarget();
    }
    if (this.revengeTarget?.alive === false) {
      this.revengeTarget = null;
    }
    if (this.angerTarget?.alive === false) {
      this.angerTarget = null;
    }
    return this.revengeTarget ?? this.angerTarget ?? this.resolveRoyalTarget();
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    if (this.alive && !this.carrier && !this.airborne && this.statuses.has("stun")) {
      if (!(this.behavior.currentState instanceof CrownCrabStunnedState)) {
        this.behavior.changeTo(CrownCrabStunnedState.name);
      }
    }
    super.update(dt);
  }

  /**
   * @param {string} clip
   */
  requestAnimation(clip) {
    this.requestedAnimation = clip;
  }

  resumePursuit() {
    this.attackTarget = null;
    this.behavior.changeTo(CrownCrabPursueState.name);
  }

  /**
   * @param {Enemy} target
   */
  startClaw(target) {
    if (this.suppressesRivalContact(target)) {
      this.resumePursuit();

      return;
    }
    this.attackTarget = target;
    this.behavior.changeTo(CrownCrabClawState.name);
  }

  /**
   * Rear exposure is measured against the semantic root's -Z forward.
   * Unknown sources receive ordinary damage, never free frontal protection.
   * @param {number} amount
   * @param {Enemy|null} source
   * @param {string} kind
   * @returns {number}
   */
  receiveDamage(amount, source = null, kind = "physical") {
    let factor = 1;
    const point = this.targetPosition(source);
    if (point && kind === "physical") {
      const direction = point.clone().sub(this.position);
      direction.y = 0;
      if (direction.lengthSq() > 0.000001) {
        const alignment = direction.normalize().dot(this.entity.forward);
        factor = alignment > 0.35 ? 0.2 : alignment < -0.35 ? 1.6 : 1;
        this.requestAnimation(alignment > 0.35 ? "front_block" : "rear_hit");
      }
    }
    // Projectile impacts deliberately do not assign revengeTarget.
    return super.receiveDamage(amount * factor, source, kind);
  }

  /**
   * @param {Enemy|null} source
   */
  onBellEncouraged(source) {
    if (!source || source === this || !this.targetPosition(source)) {
      return;
    }
    this.angerTarget = source;
    this.warningUntil = this.elapsed + 0.65;
    if (!this.carrier && !this.airborne && !this.statuses.has("stun")) {
      this.behavior.changeTo(CrownCrabAngryState.name);
    }
  }

  onCarried() {
    this.behavior.changeTo(CrownCrabCarriedState.name);
  }

  /**
   * @param {Enemy|null} thrower
   */
  onLaunched(thrower) {
    this.revengeTarget = thrower && thrower !== this ? thrower : null;
    this.behavior.changeTo(CrownCrabAirborneState.name);
  }

  onLanded() {
    this.behavior.changeTo(CrownCrabLandingState.name);
  }

  onDeath() {
    this.revengeTarget = null;
    this.angerTarget = null;
    this.attackTarget = null;
    this.behavior.changeTo(CrownCrabDeathState.name);
  }

  /**
   * Challenge only peers competing on the same approach, with a recovery cooldown.
   * @returns {CrownCrab|null}
   */
  findRival() {
    if (this.grudgesSuppressed || this.revengeTarget || this.angerTarget || this.elapsed < this.duelCooldownUntil) {
      return null;
    }
    const royal = this.resolveRoyalTarget();
    if (!royal) {
      return null;
    }
    for (const actor of this.actors) {
      if (actor === this || actor.enemyType !== this.enemyType || !actor.alive || actor.carrier || actor.airborne) {
        continue;
      }
      if (actor.elapsed < actor.duelCooldownUntil || actor.revengeTarget || actor.angerTarget) {
        continue;
      }
      if (this.distanceTo(actor) < 1.25 && actor.resolveRoyalTarget() === royal) {
        return actor;
      }
    }

    return null;
  }

  /**
   * Uses existing door leaf picking and opening capabilities. Door update retains
   * the Ammo swing/obstruction checks. No castle damage or tower targeting.
   * @param {Enemy} target
   * @returns {import("../../architecture/door/Door.js").Door|null}
   */
  findEntranceObstruction(target) {
    const point = this.targetPosition(target);
    if (!point) {
      return null;
    }
    const start = this.position.clone().add(new this.pc.Vec3(0, 0.5, 0));
    const direction = point.clone().sub(start);
    direction.y = 0;
    if (direction.lengthSq() < 0.001) {
      return null;
    }
    const end = start.clone().add(direction.normalize().mulScalar(1.3));
    let closest = null;
    for (const actor of this.actors) {
      if (actor === this) {
        continue;
      }
      const hit = actor.getPointerHit?.(start, end);
      if (hit?.door?.exteriorEntrance && hit.door.openAmount < 0.8 && (!closest || hit.distance < closest.distance)) {
        closest = hit;
      }
    }

    return closest?.door ?? null;
  }

  /**
   * Contact is rechecked at snap time so escaping the windup avoids the hit.
   * @param {Enemy} target
   * @returns {boolean}
   */
  applyClawContact(target) {
    if (this.suppressesRivalContact(target)) {
      return false;
    }
    if (!target || target.alive === false || this.distanceTo(target) > 1.4) {
      return false;
    }
    if (typeof target.receiveDamage === "function") {
      target.receiveDamage(18, this, "physical");

      return true;
    }
    if (typeof target.beginGameOver === "function") {
      target.beginGameOver(() => this.position.clone());

      return true;
    }
    return false;
  }
}
