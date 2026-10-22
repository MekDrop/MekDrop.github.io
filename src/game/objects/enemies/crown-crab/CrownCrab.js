import { Enemy } from "../shared/Enemy.js";
import { CrownCrabPursueState } from "./states/CrownCrabPursueState.js";
import { CrownCrabClawState } from "./states/CrownCrabClawState.js";
import { CrownCrabAngryState } from "./states/CrownCrabAngryState.js";
import { CrownCrabStunnedState } from "./states/CrownCrabStunnedState.js";
import { CrownCrabCarriedState } from "./states/CrownCrabCarriedState.js";
import { CrownCrabAirborneState } from "./states/CrownCrabAirborneState.js";
import { CrownCrabLandingState } from "./states/CrownCrabLandingState.js";
import { CrownCrabDeathState } from "./states/CrownCrabDeathState.js";
import { CrownCrabPlaybackState } from "./states/CrownCrabPlaybackState.js";
import { CrownCrabQueueState } from "./states/CrownCrabQueueState.js";
import { CrownCrabRecoverState } from "./states/CrownCrabRecoverState.js";
import { CrownCrabHitState } from "./states/CrownCrabHitState.js";
import { CrownCrabKnockbackState } from "./states/CrownCrabKnockbackState.js";
import { CrownCrabAnimationPlayback } from "./CrownCrabAnimationPlayback.js";
import { CrownCrabPreview } from "./CrownCrabPreview.js";
import { CrownCrabNavigation } from "./CrownCrabNavigation.js";
import { CrownCrabChecks } from "./CrownCrabChecks.js";
import { CrownCrabBehaviorCheck } from "./CrownCrabBehaviorCheck.js";
import { CROWN_CRAB_ANIMATION } from "../../../enum/CrownCrabAnimation.js";

const LOOPING = new Set(["idle", "scuttle_forward", "scuttle_sideways", "run", "revenge_run", "stun", "pickup_struggle", "airborne_tumble"]);
const PHASE_DURATIONS = new Map([["claw_windup", 0.45], ["claw_snap", 0.2], ["claw_recover", 0.45], ["angry_warn", 0.65], ["knockback", 0.45]]);

/**
 * Crab-owned artwork, Yuka behavior and Ammo movement through the shared foundation.
 */
export class CrownCrab extends Enemy {
  /**
   * @type {string|null}
   */
  static modelUrl = null;
  /**
   * @type {CrownCrabAnimationPlayback|null}
   */
  animationPlayback = null;
  /**
   * @type {CrownCrabNavigation|null}
   */
  navigation = null;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  modelRoot = null;
  /**
   * @type {string}
   */
  testAnimation = "idle";
  /**
   * @type {string}
   */
  hitAnimation = "rear_hit";
  /**
   * @type {number}
   */
  queueRetryAfter = 0;
  /**
   * @type {Enemy|null}
   */
  queueBlocker = null;
  /**
   * @type {string}
   */
  checkStatus = "";
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
   * @type {WeakSet<Enemy>}
   */
  reachedRoyals = new WeakSet();

  /**
   * @param {import("../../ObjectTypes.js").MapObjectOptions} options
   */
  constructor(options) {
    super(options);

    // Match the armored body core; articulated claws and legs extend beyond it.
    this.radius = 0.42;
    this.height = 1.1;
    this.bellImmune = true;
    this.statusImmunities = new Set(["confused"]);
    if (options.modelLibrary && this.constructor.modelUrl) {
      const url = this.constructor.modelUrl;
      this.modelRoot = options.modelLibrary.instantiate(url);
      // The clips key the imported rig root, so keep yaw calibration outside it.
      const modelOrientation = new this.pc.Entity("Crown Crab model orientation");
      modelOrientation.setLocalEulerAngles(0, 180, 0);
      modelOrientation.addChild(this.modelRoot);
      this.entity.addChild(modelOrientation);
      this.animationPlayback = new CrownCrabAnimationPlayback(this.modelRoot, options.modelLibrary, url,
        Object.values(CROWN_CRAB_ANIMATION).map(/**
         *
         * @param {string} name
         */
          (name) => ({
            name,
            looping: LOOPING.has(name),
          })));
      this.navigation = new CrownCrabNavigation(this);
    }
    const states = [
      new CrownCrabPursueState(),
      new CrownCrabClawState(),
      new CrownCrabAngryState(),
      new CrownCrabStunnedState(),
      new CrownCrabCarriedState(),
      new CrownCrabAirborneState(),
      new CrownCrabLandingState(),
      new CrownCrabDeathState(),
      new CrownCrabPlaybackState(),
      new CrownCrabQueueState(),
      new CrownCrabRecoverState(),
      new CrownCrabHitState(),
      new CrownCrabKnockbackState(),
    ];
    for (const state of states) {
      this.behavior.add(state.constructor.name, state);
    }
    this.behavior.changeTo(CrownCrabPursueState.name);
    if (options.definition.testClip) {
      this.testPlayClip(options.definition.testClip);
    }
  }

  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return this.modelUrl ? [this.modelUrl] : [];
  }

  onSceneReady() {
    super.onSceneReady();
    if (this.definition.testAudit) {
      this.app.once("postrender", () => {
        this.testVerifyBehavior().catch(console.error);
      });
    }
  }

  async testVerifyBehavior() {
    await new CrownCrabBehaviorCheck(this).run();
  }

  /**
   * @returns {string}
   */
  get testStatus() {
    return `${super.testStatus} | ${this.requestedAnimation} | target ${this.pursuitTarget?.definition?.id ?? "none"} | ${this.checkStatus}`;
  }

  /**
   * @param {string} clip
   */
  testPlayClip(clip) {
    if (!this.alive || this.airborne || this.carrier || !Object.values(CROWN_CRAB_ANIMATION).includes(clip)) {
      return false;
    }
    this.testAnimation = clip;
    this.behavior.changeTo(CrownCrabPlaybackState.name);

    return true;
  }

  async testCapturePreview() {
    console.info("CROWN_CRAB_PREVIEW_START");
    this.testPlayClip("idle");
    await new Promise(/**
     *
     * @param {() => void} resolve
     */
      (resolve) => this.app.once("postrender", resolve));
    const counts = await CrownCrabPreview.capture(this);
    this.checkStatus = `PNG ${counts.visible} visible / ${counts.transparent} transparent`;
  }

  async testVerifyClips() {
    console.info("CROWN_CRAB_PLAYBACK_START");
    this.checkStatus = "Sampling exported joint playback";
    await new CrownCrabChecks(this).verifyClips();
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
   * @param {boolean} restart
   */
  requestAnimation(clip, restart = false) {
    this.requestedAnimation = clip;
    this.animationPlayback?.play(clip, restart, PHASE_DURATIONS.get(clip) ?? null);
  }

  resumePursuit() {
    this.attackTarget = null;
    this.queueBlocker = null;
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
    this.hitAnimation = "rear_hit";
    let factor = 1;
    const point = this.targetPosition(source);
    if (point && kind === "physical") {
      const direction = point.clone().sub(this.position);
      direction.y = 0;
      if (direction.lengthSq() > 0.000001) {
        const alignment = direction.normalize().dot(this.entity.forward);
        factor = alignment > 0.35 ? 0.2 : alignment < -0.35 ? 1.6 : 1;
        this.hitAnimation = alignment > 0.35 ? "front_block" : "rear_hit";
      }
    }
    // Projectile impacts deliberately do not assign revengeTarget.
    return super.receiveDamage(amount * factor, source, kind);
  }

  onDamaged() {
    if (this.alive && !this.carrier && !this.airborne && !this.statuses.has("stun")) {
      this.behavior.changeTo(CrownCrabHitState.name);
    }
  }

  /**
   * @param {string} name
   * @param {{impulse?:{x:number,y:number,z:number}}} details
   */
  onStatusApplied(name, details) {
    if (name === "knockback" && !this.carrier && !this.airborne) {
      const impulse = details.impulse;
      if (impulse && [impulse.x, impulse.y, impulse.z].every(Number.isFinite)) {
        this.entity.rigidbody?.applyImpulse(impulse.x, impulse.y, impulse.z);
      }
      this.behavior.changeTo(CrownCrabKnockbackState.name);
    }
  }

  /**
   * @param {Enemy} target @returns {Enemy|null}
   */
  findQueueBlocker(target) {
    if (this.grudgesSuppressed || this.elapsed < this.queueRetryAfter || this.revengeTarget || this.angerTarget) {
      return null;
    }
    const destination = this.targetPosition(target);
    if (!destination) {
      return null;
    }
    const forward = destination.clone().sub(this.position);
    forward.y = 0;
    forward.normalize();
    for (const actor of this.actors) {
      if (actor === this || !actor.isEnemy || !actor.alive || actor.airborne || actor.carrier || actor.enemyType === this.enemyType) {
        continue;
      }
      const point = this.targetPosition(actor);
      if (!point) {
        continue;
      }
      const offset = point.clone().sub(this.position);
      const ahead = offset.dot(forward);
      const lateral = Math.abs(offset.x * forward.z - offset.z * forward.x);
      if (ahead > 0 && ahead < 2.2 && lateral < this.radius + (actor.radius ?? 0.3)) {
        return actor;
      }
    }

    return null;
  }

  /**
   * @returns {import("playcanvas").Vec3|null}
   */
  queueBypassPoint() {
    const goal = this.targetPosition(this.pursuitTarget);
    const blocker = this.targetPosition(this.queueBlocker);
    if (!goal || !blocker) {
      return null;
    }
    const direction = goal.clone().sub(this.position);
    direction.y = 0;
    direction.normalize();
    const side = new this.pc.Vec3(-direction.z, 0, direction.x);
    const gap = this.radius + (this.queueBlocker.radius ?? 0.3) + 0.3;
    const point = blocker.clone().add(direction.mulScalar(0.65)).add(side.mulScalar(gap));
    point.y = this.position.y;

    return point;
  }

  facePursuitTarget() {
    const point = this.targetPosition(this.pursuitTarget);
    if (point) {
      this.entity.setEulerAngles(0, Math.atan2(this.position.x - point.x, this.position.z - point.z) * 180 / Math.PI, 0);
    }
  }

  /**
   * @param {Enemy} blocker
   */
  demandQueuePosition(blocker) {
    this.queueBlocker = blocker;
    this.behavior.changeTo(CrownCrabQueueState.name);
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
    if (direction.lengthSq() < 0.000001) {
      return null;
    }
    const end = start.clone().add(direction.normalize().mulScalar(1.8));
    const bodyHit = this.app.systems?.rigidbody?.raycastAll(start, end, { sort: true }).find(/**
     * @param {import("playcanvas").RaycastResult} hit
     */ (hit) => hit.entity !== this.entity && !hit.entity.isDescendantOf(this.entity));
    let closest = null;
    for (const actor of this.actors) {
      if (actor === this) {
        continue;
      }
      // Castle-owned doors are not separate entries in the scene registry.
      for (const candidate of [actor, ...(actor.entranceDoors ?? [])]) {
        const physicsHit = bodyHit && (bodyHit.entity === candidate.entity || bodyHit.entity.isDescendantOf(candidate.entity));
        const hit = candidate.getPointerHit?.(start, end) ?? (physicsHit ? {
          door: candidate,
          distance: bodyHit.point.distance(start),
        } : null);
        if (typeof hit?.door?.openTemporarily === "function" && hit.door.openAmount < 0.8 && (!closest || hit.distance < closest.distance)) {
          closest = hit;
        }
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
    if (!this.hasClearContact(target)) {
      return false;
    }
    if (typeof target.receiveDamage === "function") {
      target.receiveDamage(18, this, "physical");

      return true;
    }
    if (typeof target.beginGameOver === "function") {
      if (this.reachedRoyals.has(target)) {
        return false;
      }
      const performance = target.beginGameOver(() => this.position.clone());
      if (performance !== null && performance !== false) {
        this.reachedRoyals.add(target);
        target.startGameOverPerformance?.();
      }

      return true;
    }
    return false;
  }

  /**
   * @param {Enemy} target @returns {boolean}
   */
  hasClearContact(target) {
    const system = this.app.systems?.rigidbody;
    const point = this.targetPosition(target);
    if (!system || !point) {
      return true;
    }
    const start = this.position.clone().add(new this.pc.Vec3(0, 0.45, 0));
    const height = typeof target.beginGameOver === "function" ? 0.9 : 0.45;
    const end = point.clone().add(new this.pc.Vec3(0, height, 0));
    const hits = system.raycastAll(start, end, { sort: true });
    for (const hit of hits) {
      if (hit.entity === this.entity || hit.entity.isDescendantOf(this.entity)) {
        continue;
      }
      return hit.entity === target.entity || hit.entity.isDescendantOf(target.entity);
    }

    return true;
  }

  destroy() {
    this.navigation?.destroy();
    this.navigation = null;
    this.animationPlayback?.destroy();
    this.animationPlayback = null;
    super.destroy();
  }
}
