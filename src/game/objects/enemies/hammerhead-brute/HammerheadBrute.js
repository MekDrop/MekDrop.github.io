import { Enemy } from "../shared/Enemy.js";
import { HammerPursueState } from "./states/HammerPursueState.js";
import { HammerWindupState } from "./states/HammerWindupState.js";
import { HammerSwingState } from "./states/HammerSwingState.js";
import { HammerRecoverState } from "./states/HammerRecoverState.js";
import { HammerStunState } from "./states/HammerStunState.js";
import { HammerDeathState } from "./states/HammerDeathState.js";
import { HammerPlaybackState } from "./states/HammerPlaybackState.js";
import { HammerDoorBashState } from "./states/HammerDoorBashState.js";
import { HammerHitState } from "./states/HammerHitState.js";
import { HammerStunRecoverState } from "./states/HammerStunRecoverState.js";
import { HammerRejectPickupState } from "./states/HammerRejectPickupState.js";
import { HammerAnimationPlayback } from "./HammerAnimationPlayback.js";
import { HammerPreview } from "./HammerPreview.js";
import { HammerChecks } from "./HammerChecks.js";
import { HammerNavigation } from "./HammerNavigation.js";
import { HAMMERHEAD_BRUTE_ANIMATION } from "./HammerheadBruteAnimation.js";

const LOOPING = new Set(["idle", "heavy_walk", "heavy_run", "stun"]);

/**
 * Siege brute with imported Tripo artwork and object-owned Yuka behavior.
 */
export class HammerheadBrute extends Enemy {
  /**
   * @type {string|null}
   */
  static modelUrl = null;
  /**
   * @type {WeakMap<import("../../architecture/door/Door.js").Door, number>}
   */
  #doorHits = new WeakMap();
  /**
   * @type {boolean}
   */
  #retired = false;
  /**
   * @type {WeakSet<import("../shared/Enemy.js").EnemyActor>}
   */
  #reachedRoyals = new WeakSet();

  /**
   * @param {import("../../ObjectTypes.js").MapObjectOptions} options
   */
  constructor(options) {
    super(options);

    this.bellImmune = true;
    this.statusImmunities = new Set(["confused", "confusion"]);
    this.radius = 0.7;
    this.height = 2.1;
    this.attackRange = 2.4;
    this.attackTarget = null;
    this.royalTarget = null;
    this.phaseTime = 0;
    this.nextAttack = 0;
    this.requestedClip = "idle";
    this.navigation = new HammerNavigation(this);
    for (const Type of [HammerPursueState, HammerWindupState, HammerSwingState,
      HammerRecoverState, HammerStunState, HammerDeathState, HammerPlaybackState,
      HammerDoorBashState, HammerHitState, HammerStunRecoverState, HammerRejectPickupState]) {
      this.behavior.add(Type.name, new Type());
    }
    this.behavior.changeTo(HammerPursueState.name);
    if (this.constructor.modelUrl && options.modelLibrary) {
      this.modelRoot = options.modelLibrary.instantiate(this.constructor.modelUrl);
      this.modelRoot.setLocalEulerAngles(0, 180, 0);
      this.entity.addChild(this.modelRoot);
      const clips = Object.values(HAMMERHEAD_BRUTE_ANIMATION).map(/**
       *
       * @param {string} name
       */
        (name) => ({
          name,
          looping: LOOPING.has(name),
        }));
      this.playback = new HammerAnimationPlayback(this.modelRoot, options.modelLibrary, this.constructor.modelUrl, clips);
    }
    if (this.definition.inspectClips) {
      this.testPlayClip("idle");
    }
  }

  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return this.modelUrl ? [this.modelUrl] : [];
  }

  /**
   * @returns {string}
   */
  get testStatus() {
    return `${super.testStatus}; clip=${this.requestedClip}; ${this.playback?.status.time.toFixed(2) ?? "no playback"}`;
  }

  /**
   * @param {string} name
   */
  testPlayClip(name) {
    this.transition(HammerPlaybackState.name);
    this.playClip(name);
  }

  resumeBehavior() {
    this.transition(HammerPursueState.name);
  }

  capturePreview() {
    return HammerPreview.capture(this);
  }

  verifyClips() {
    return new HammerChecks(this).verifyClips();
  }

  /**
   * @param {string} mode
   */
  verifyBehavior(mode) {
    return new HammerChecks(this).verifyBehavior(mode);
  }

  /**
   * @param {number} phase
   */
  testSample(phase) {
    this.playback?.sample(phase);
  }

  onSceneReady() {
    super.onSceneReady();
    this.entity.rigidbody.mass = 320;
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    if (this.#retired || !Number.isFinite(dt) || dt <= 0) {
      return;
    }
    this.phaseTime += dt;
    super.update(dt);
  }

  /**
   * A requested clip is not evidence of embedded animation playback.
   * @param {string} name
   */
  playClip(name) {
    this.requestedClip = name;
    this.playback?.play(name);
  }

  /**
   * @param {string} name
   */
  transition(name) {
    this.behavior.changeTo(name);
  }

  /**
   * @returns {boolean}
   */
  canBeCarriedBy() {
    return false;
  }

  /**
   * @returns {boolean}
   */
  beginCarry() {
    if (this.alive && [HammerPursueState.name, HammerPlaybackState.name].includes(this.stateName)) {
      this.transition(HammerRejectPickupState.name);
    }
    return false;
  }

  /**
   * Too heavy for carrier throws, including direct launch calls.
   * @returns {boolean}
   */
  launch() {
    return false;
  }

  /**
   * Commit facing to Ammo as well as the entity; movement remains velocity-driven.
   * Otherwise the next physics sync restores the old yaw before hammer contact.
   * @param {import("../shared/Enemy.js").EnemyActor} target
   * @param {number} speed
   * @param {number} arrivalRadius
   * @returns {boolean}
   */
  moveToward(target, speed = 1.2, arrivalRadius = 0.05) {
    const moving = super.moveToward(target, speed, arrivalRadius);
    if (moving) {
      this.entity.rigidbody.teleport?.(this.position.clone(), this.entity.getRotation().clone());
    }
    return moving;
  }

  pursue() {
    this.royalTarget = this.resolveRoyalTarget();
    if (!this.royalTarget || this.#reachedRoyals.has(this.royalTarget)) {
      this.stop();
      this.playClip("idle");

      return;
    }
    const approach = this.navigation.next(this.royalTarget) ?? this.royalTarget;
    this.attackTarget = this.#obstruction(approach) ?? this.royalTarget;
    // Aim at the actor's origin, leaving reach for offset collision geometry.
    if (this.distanceTo(this.attackTarget) > this.attackRange - 0.4) {
      this.playClip("heavy_walk");
      this.moveToward(this.attackTarget === this.royalTarget ? approach : this.attackTarget, 0.85);

      return;
    }
    // Face once before stopping; the committed windup then permits a sidestep.
    this.moveToward(this.attackTarget, 0.85);
    this.stop();
    if (this.elapsed >= this.nextAttack) {
      this.transition(typeof this.attackTarget.openTemporarily === "function" ? HammerDoorBashState.name : HammerWindupState.name);
    }
  }

  /**
   * Only obstructions between the brute and its actual royal qualify.
   * @param {import("../shared/Enemy.js").EnemyActor} approach
   * @returns {import("../shared/Enemy.js").EnemyActor|null}
   */
  #obstruction(approach) {
    const royal = this.targetPosition(approach);
    const origin = this.position;
    const dx = royal.x - origin.x;
    const dz = royal.z - origin.z;
    const lengthSquared = dx * dx + dz * dz;
    if (lengthSquared < 0.01) {
      return null;
    }
    const candidates = [];
    for (const actor of this.actors) {
      if (actor.isSabotageTower && actor.alive !== false && typeof actor.receiveDamage === "function") {
        candidates.push(actor);
      }
      for (const door of actor.entranceDoors ?? []) {
        if (door.openAmount < 0.8) {
          candidates.push(door);
        }
      }
    }

    return candidates.filter(/**
     *
     * @param {import("../shared/Enemy.js").EnemyActor} actor
     */
      (actor) => {
        const point = this.targetPosition(actor);
        if (!point || this.distanceTo(actor) > 5) {
          return false;
        }
        const x = point.x - origin.x;
        const z = point.z - origin.z;
        const t = (x * dx + z * dz) / lengthSquared;
        const perpendicular = Math.abs(x * dz - z * dx) / Math.sqrt(lengthSquared);

        return t > 0 && t <= 1 && perpendicular < 1.4;
      }).sort(/**
     *
     * @param {import("../shared/Enemy.js").EnemyActor} a
     * @param {import("../shared/Enemy.js").EnemyActor} b
     */
      (a, b) => this.distanceTo(a) - this.distanceTo(b))[0] ?? null;
  }

  /**
   * Contact fan uses Ammo raycasts; walls intercept each ray before recipients.
   * @returns {Set<import("playcanvas").Entity>}
   */
  #hammerContacts() {
    const contacts = new Set();
    const physics = this.app.systems?.rigidbody;
    if (!physics?.raycastAll) {
      return contacts;
    }
    const origin = this.position.clone();
    origin.y += 0.9;
    const forward = this.entity.forward;
    const yaw = Math.atan2(forward.x, forward.z);
    for (let step = -6; step <= 6; step++) {
      const angle = yaw + step * Math.PI / 12;
      const end = new this.pc.Vec3(origin.x + Math.sin(angle) * this.attackRange,
        origin.y, origin.z + Math.cos(angle) * this.attackRange);
      const hits = physics.raycastAll(origin, end).filter(/**
       *
       * @param {import("playcanvas").RaycastResult} hit
       */
        (hit) =>
          hit.entity !== this.entity && !hit.entity.isDescendantOf(this.entity));
      hits.sort(/**
       *
       * @param {import("playcanvas").RaycastResult} a
       * @param {import("playcanvas").RaycastResult} b
       */
        (a, b) => a.point.distance(origin) - b.point.distance(origin));
      if (hits[0]) {
        contacts.add(hits[0].entity);
      }
    }

    return contacts;
  }

  strike() {
    if (!this.alive || this.statuses.has("stun")) {
      return;
    }
    const contacts = this.#hammerContacts();
    const recipients = new Set(this.actors);
    for (const actor of this.actors) {
      for (const door of actor.entranceDoors ?? []) {
        recipients.add(door);
      }
    }
    for (const actor of recipients) {
      const entity = actor.audienceActor?.entity ?? actor.entity;
      if (actor === this || actor.alive === false || !entity || this.distanceTo(actor) > this.attackRange + 0.3) {
        continue;
      }
      const touched = [...contacts].some(/**
       *
       * @param {import("playcanvas").Entity} hit
       */
        (hit) => hit === entity || hit.isDescendantOf(entity));
      if (!touched) {
        continue;
      }
      if (typeof actor.receiveDamage === "function") {
        actor.receiveDamage(45, this, "hammer");
      } else if (typeof actor.beginGameOver === "function") {
        if (!this.#reachedRoyals.has(actor)) {
          this.#reachedRoyals.add(actor);
          actor.beginGameOver(() => this.position.clone());
        }
      } else if (typeof actor.openTemporarily === "function" && actor.openAmount < 0.8) {
        const blows = (this.#doorHits.get(actor) ?? 0) + 1;
        this.#doorHits.set(actor, blows);
        if (blows >= 3) {
          actor.clearGlue?.();
          // Existing Door update retains physical swing obstruction checks.
          actor.sequenceOpenAmount = 1;
        }
      }
      if (actor.isSabotageTower) {
        this.#dislodge(actor);
      }
    }
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} tower
   */
  #dislodge(tower) {
    for (const occupant of this.actors) {
      if (occupant.occupiedTower !== tower || typeof occupant.releaseTarget !== "function" || typeof occupant.launch !== "function") {
        continue;
      }
      occupant.releaseTarget();
      occupant.launch({
        velocity: {
          x: this.entity.forward.x * 3,
          y: 4,
          z: this.entity.forward.z * 3,
        },
        thrower: this,
      });
    }
  }

  /**
   * @param {string} name
   */
  onStatusApplied(name) {
    if (name === "stun") {
      this.transition(HammerStunState.name);
    }
  }

  onDamaged() {
    if (this.alive && !this.statuses.has("stun")) {
      this.transition(HammerHitState.name);
    }
  }

  onDeath() {
    this.attackTarget = null;
    this.transition(HammerDeathState.name);
  }

  destroy() {
    if (this.#retired) {
      return;
    }
    this.#retired = true;
    this.navigation.destroy();
    this.playback?.destroy();
    super.destroy();
  }
}
