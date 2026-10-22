import { Enemy } from "../shared/Enemy.js";
import { CinderPursueState } from "./states/CinderPursueState.js";
import { CinderFireWindupState } from "./states/CinderFireWindupState.js";
import { CinderFireLoopState } from "./states/CinderFireLoopState.js";
import { CinderFireRecoverState } from "./states/CinderFireRecoverState.js";
import { CinderCarriedState } from "./states/CinderCarriedState.js";
import { CinderAirborneState } from "./states/CinderAirborneState.js";
import { CinderLandState } from "./states/CinderLandState.js";
import { CinderStunState } from "./states/CinderStunState.js";
import { CinderStunRecoverState } from "./states/CinderStunRecoverState.js";
import { CinderDeathState } from "./states/CinderDeathState.js";
import { CinderWarnState } from "./states/CinderWarnState.js";
import { CinderHitState } from "./states/CinderHitState.js";
import { CinderPlaybackState } from "./states/CinderPlaybackState.js";
import { CinderHotPatch } from "./CinderHotPatch.js";
import { CinderSteam } from "./CinderSteam.js";
import { CinderAnimationPlayback } from "./CinderAnimationPlayback.js";
import { CINDER_IMP_ANIMATION } from "../../../enum/CinderImpAnimation.js";
import { CinderVictoryState } from "./states/CinderVictoryState.js";
import { CinderPreview } from "./CinderPreview.js";
import { CinderChecks } from "./CinderChecks.js";
import { CinderBreath } from "./CinderBreath.js";
import { CinderRivalAttackState } from "./states/CinderRivalAttackState.js";
import { CinderKnockbackState } from "./states/CinderKnockbackState.js";
import { CinderNavigation } from "./CinderNavigation.js";

const LOOPING_CLIPS = new Set(["idle", "walk", "run", "fire_loop", "stun", "carried_struggle", "airborne_tumble"]);
const PHASE_DURATIONS = new Map([["fire_windup", 0.4], ["fire_loop", 0.65], ["fire_recover", 0.35], ["rival_attack", 0.65], ["hit", 0.3], ["land", 0.2], ["land_recover", 0.35], ["stun_recover", 0.35], ["angry_warn", 0.45], ["death", 1.2]]);

/**
 * Furnace imp: imported Tripo artwork, authored clips, and object-owned Yuka behavior.
 */
export class CinderImp extends Enemy {
  /**
   * @type {string|null}
   */
  static modelUrl = null;
  /**
   * @type {CinderHotPatch[]}
   */
  #patches = [];
  /**
   * @type {Map<import("../shared/Enemy.js").EnemyActor, number>}
   */
  #burnHealth = new Map();
  /**
   * @type {Set<import("../shared/Enemy.js").EnemyActor>}
   */
  #burned = new Set();
  /**
   * @type {CinderSteam[]}
   */
  #steamEffects = [];
  /**
   * @type {number}
   */
  #nextSteam = 0;
  /**
   * @type {string}
   */
  #checkStatus = "";
  /**
   * @type {CinderBreath|null}
   */
  #breath = null;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #heatLight = null;

  /**
   * @param {import("../../ObjectTypes.js").MapObjectOptions} options
   */
  constructor(options) {
    super(options);

    this.bellImmune = true;
    this.statusImmunities = new Set(["confused", "burn"]);
    this.element = "fire";
    this.attackTarget = null;
    this.revengeUntil = 0;
    this.nextFire = 0;
    this.attackRange = 1.8;
    this.attackCooldown = 1.5;
    this.walkSpeed = 1.056;
    this.clip = "idle";
    this.heat = 0;
    this.navigation = new CinderNavigation(this);
    for (const Type of [CinderPursueState, CinderFireWindupState, CinderFireLoopState,
      CinderFireRecoverState, CinderCarriedState, CinderAirborneState, CinderLandState,
      CinderStunState, CinderStunRecoverState, CinderDeathState, CinderWarnState, CinderHitState, CinderPlaybackState, CinderVictoryState, CinderRivalAttackState, CinderKnockbackState]) {
      this.behavior.add(Type.name, new Type());
    }
    this.behavior.changeTo(CinderPursueState.name);
    if (this.constructor.modelUrl) {
      this.modelRoot = options.modelLibrary.instantiate(this.constructor.modelUrl);
      // The GLB faces +Z; the semantic movement root faces PlayCanvas -Z.
      this.modelRoot.setLocalEulerAngles(0, 180, 0);
      this.entity.addChild(this.modelRoot);
      const clips = Object.values(CINDER_IMP_ANIMATION).map(/**
       *
       * @param {string} name
       */
        (name) => ({
          name,
          looping: LOOPING_CLIPS.has(name),
        }));
      this.animationPlayback = new CinderAnimationPlayback(this.modelRoot, options.modelLibrary, this.constructor.modelUrl, clips);
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
   * @returns {import("playcanvas").Entity[]}
   */
  get visualRoots() {
    return [this.modelRoot ?? this.entity];
  }

  /**
   * @returns {string}
   */
  get testStatus() {
    return `${super.testStatus}; clip=${this.clip}; heat=${this.heat.toFixed(1)}; ${this.#checkStatus}`;
  }

  async testVerifyClips() {
    this.#checkStatus = "Verifying clips";
    const count = await new CinderChecks(this).verifyClips();
    this.#checkStatus = `Sampled ${count} clips`;
  }

  async testCapturePreview() {
    this.testPlayClip("idle");
    this.heat = 0;
    await new Promise(/**
     *
     * @param {() => void} resolve
     */
      (resolve) => this.app.once("postrender", resolve));
    const counts = await CinderPreview.capture(this);
    this.#checkStatus = `PNG ${counts.visible} visible/${counts.transparent} transparent`;
  }

  /**
   * @param {string} clip
   * @param {number} phase
   */
  testSampleClip(clip, phase) {
    this.testPlayClip(clip);
    this.animationPlayback?.sample(phase);
  }

  /**
   * Preload normal flame assets through existing generic dependency discovery.
   */
  static assetDefinitionsFor() {
    return [{ object: "Fire" }];
  }

  /**
   * @param {string} clip
   */
  playClip(clip) {
    this.clip = clip;
    this.animationPlayback?.play(clip, false, PHASE_DURATIONS.get(clip) ?? null);
  }

  onSceneReady() {
    super.onSceneReady();
    if (this.modelRoot && !this.#breath) {
      this.#breath = new CinderBreath(this);
    }
    if (!this.#heatLight) {
      this.#heatLight = new this.pc.Entity("Cinder carried heat glow");
      this.#heatLight.addComponent("light", {
        type:"point",
        color:new this.pc.Color(1,0.25,0.025),
        intensity:0,
        range:1.7,
        castShadows:false,
      });
      this.#heatLight.setLocalPosition(0,0.55,0);
      this.#heatLight.enabled = false;
      this.entity.addChild(this.#heatLight);
    }
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} target
   */
  faceTarget(target) {
    const point = this.targetPosition(target);
    if (point) {
      this.entity.setEulerAngles(0, Math.atan2(this.position.x - point.x, this.position.z - point.z) * 180 / Math.PI, 0);
    }
  }

  /**
   * @param {string} stateName
   */
  transition(stateName) {
    this.behavior.changeTo(stateName);
  }

  /**
   * @param {string} clip
   */
  testPlayClip(clip) {
    if (!this.alive || this.carrier || this.airborne) {
      return false;
    }
    this.previewClip = clip;
    this.behavior.changeTo(CinderPlaybackState.name);
    this.animationPlayback?.play(clip, true);

    return true;
  }

  resumeBehavior() {
    if (this.alive && !this.carrier && !this.airborne) {
      this.behavior.changeTo(this.statuses.has("stun") ? CinderStunState.name : CinderPursueState.name);
    }
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    super.update(dt);
    this.#breath?.update();
    if (!Number.isFinite(dt) || !(dt > 0) || !this.alive) {
      return;
    }
    this.heat = this.carrier ? Math.min(1, this.heat + dt * 0.5) : Math.max(0, this.heat - dt * 0.6);
    if (this.#heatLight) {
      this.#heatLight.enabled = this.heat > 0;
      this.#heatLight.light.intensity = this.heat * 2;
    }
    for (const patch of this.#patches) {
      patch.update(dt);
    }
    this.#patches = this.#patches.filter(/**
     *
     * @param {CinderHotPatch} patch
     */
      (patch) => !patch.expired);
    for (const effect of this.#steamEffects) {
      effect.update(dt);
    }
    this.#steamEffects = this.#steamEffects.filter(/**
     *
     * @param {CinderSteam} effect
     */
      (effect) => effect.remaining > 0);
  }

  /**
   * @returns {import("../shared/Enemy.js").EnemyActor|null}
   */
  chooseTarget() {
    if (this.grudgesSuppressed) {
      return this.resolveRoyalTarget();
    }
    if (this.elapsed < this.revengeUntil && this.thrower?.alive !== false && this.thrower?.entity) {
      return this.thrower;
    }
    const rival = this.actors.find(/**
     *
     * @param {import("../shared/Enemy.js").EnemyActor} actor
     */
      (actor) => actor.isEnemy && actor.alive &&
      this.isFrostActor(actor) && this.distanceTo(actor) < 3);

    return rival ?? this.resolveRoyalTarget();
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} actor
   * @returns {boolean}
   */
  isFrostActor(actor) {
    return actor?.element === "frost" || typeof actor?.combat?.chill === "function";
  }

  /**
   * Only burn route obstructions actually hit by the physics query.
   * @param {import("../shared/Enemy.js").EnemyActor} target
   */
  findObstruction(target) {
    const point = this.targetPosition(target);
    if (!point || !this.app.systems?.rigidbody) {
      return null;
    }
    const from = this.position.clone().add(new this.pc.Vec3(0, 0.6, 0));
    const to = new this.pc.Vec3(point.x, point.y + 0.6, point.z);
    const hits = this.app.systems.rigidbody.raycastAll(from, to);
    hits.sort(/**
     *
     * @param {import("playcanvas").RaycastResult} a
     * @param {import("playcanvas").RaycastResult} b
     */
      (a, b) => a.hitFraction - b.hitFraction);
    for (const hit of hits) {
      let node = hit.entity;
      while (node && node !== this.entity && node !== target.entity) {
        const actor = this.actors.find(/**
         *
         * @param {import("../shared/Enemy.js").EnemyActor} candidate
         */
          (candidate) => candidate.entity === node);
        if (actor) {
          if (this.#burned.has(actor)) {
            break;
          }
          return actor.isTower || actor.definition?.isTower ? null :
            actor.isFlammable || actor.definition?.flammable ? actor : null;
        }
        node = node.parent;
      }
      if (node === this.entity) {
        continue;
      }
      // Any nearer solid surface occludes the attack, even if it cannot burn.
      if (node !== target.entity) {
        return null;
      }
    }

    return null;
  }

  /**
   * Check genuine physics visibility, excluding our own capsule.
   * @param {import("../shared/Enemy.js").EnemyActor} target
   */
  canReachWithFire(target) {
    if (!target || this.distanceTo(target) > this.attackRange) {
      return false;
    }
    const point = this.targetPosition(target);
    if (!this.app.systems?.rigidbody) {
      return false;
    }
    const from = this.position.clone().add(new this.pc.Vec3(0, 0.6, 0));
    const to = new this.pc.Vec3(point.x, point.y + 0.6, point.z);
    const hits = this.app.systems.rigidbody.raycastAll(from, to);
    hits.sort(/**
     *
     * @param {import("playcanvas").RaycastResult} a
     * @param {import("playcanvas").RaycastResult} b
     */
      (a, b) => a.hitFraction - b.hitFraction);
    for (const hit of hits) {
      let node = hit.entity;
      while (node && node !== this.entity && node !== target.entity) {
        node = node.parent;
      }
      if (node === this.entity) {
        continue;
      }
      return node === target.entity;
    }

    return true;
  }

  /**
   * Damage is continuous over the fire contact phase, never during windup.
   * @param {number} dt
   */
  performFire(dt) {
    const target = this.attackTarget;
    if (this.suppressesRivalContact(target)) {
      return;
    }
    if (!this.canReachWithFire(target)) {
      return;
    }
    if (this.isFrostActor(target)) {
      target.applyStatus?.("steam", {
        duration: 0.4,
        source: this,
      });
      this.applyStatus("steam", {
        duration: 0.4,
        source: target,
      });
      target.receiveDamage?.(18 * dt, this, "steam");
      this.emitSteam(this.position, target);

      return;
    }
    if (target.isFlammable || target.definition?.flammable) {
      if (typeof target.receiveDamage === "function") {
        target.receiveDamage(32 * dt, this, "fire");
      } else {
        const remaining = (this.#burnHealth.get(target) ?? target.definition?.burnHealth ?? 40) - 32 * dt;
        this.#burnHealth.set(target, remaining);
        if (remaining <= 0 && !this.#burned.has(target)) {
          this.#burned.add(target);
          target.destroy();
          this.runtime.onObjectRemoved?.(target);
        }
      }
    } else if (typeof target.receiveDamage === "function") {
      target.receiveDamage(24 * dt, this, "fire");
    } else if (typeof target.beginGameOver === "function") {
      target.beginGameOver(() => this.position);
      this.behavior.changeTo(CinderVictoryState.name);
    }
  }

  /**
   * @param {import("playcanvas").Vec3} position
   */
  addHotPatch(position) {
    if (this.#patches.length >= 6) {
      this.#patches.shift().destroy();
    }
    this.#patches.push(new CinderHotPatch(this, position));
  }

  /**
   * @param {import("playcanvas").Vec3} position
   * @param {import("../shared/Enemy.js").EnemyActor} rival
   */
  emitSteam(position, rival) {
    if (this.elapsed < this.#nextSteam) {
      return;
    }
    this.#nextSteam = this.elapsed + 0.3;
    if (this.app.systems?.particlesystem) {
      this.#steamEffects.push(new CinderSteam(this, position));
    }
    this.runtime.onEnemySteam?.(position, this, rival);
  }

  onBellEncouraged() {
    if (this.alive && !this.carrier && !this.airborne && !this.statuses.has("stun")) {
      this.behavior.changeTo(CinderWarnState.name);
    }
  }

  onCarried() {
    this.behavior.changeTo(CinderCarriedState.name);
  }
  onLaunched() {
    this.behavior.changeTo(CinderAirborneState.name);
  }
  onLanded() {
    this.revengeUntil = this.elapsed + 6;
    this.behavior.changeTo(CinderLandState.name);
  }
  /**
   * @param {string} name
   * @param {{source?: import("../shared/Enemy.js").EnemyActor,impulse?:{x:number,y:number,z:number}}} details
   */
  onStatusApplied(name, details) {
    if ((name === "slow" || name === "stun") && this.isFrostActor(details?.source)) {
      this.emitSteam(this.position, details.source);
    }
    if (name === "knockback" && !this.carrier && !this.airborne && !this.statuses.has("stun")) {
      this.behavior.changeTo(CinderKnockbackState.name);
      const impulse = details?.impulse;
      if (impulse && [impulse.x,impulse.y,impulse.z].every(Number.isFinite)) {
        this.entity.rigidbody?.applyImpulse(impulse.x, impulse.y, impulse.z);
      }
    }
    if (name === "stun" && !this.carrier && !this.airborne) {
      this.behavior.changeTo(CinderStunState.name);
    }
  }
  onDamaged() {
    if (this.alive && !this.carrier && !this.airborne && !this.statuses.has("stun")) {
      this.behavior.changeTo(CinderHitState.name);
    }
  }
  onDeath() {
    this.#breath?.destroy();
    this.#breath = null;
    if (this.#heatLight) {
      this.#heatLight.enabled = false;
    }
    for (const patch of this.#patches) {
      patch.destroy();
    }
    this.#patches = [];
    for (const effect of this.#steamEffects) {
      effect.destroy();
    }
    this.#steamEffects = [];
    this.behavior.changeTo(CinderDeathState.name);
  }
  destroy() {
    this.navigation.destroy();
    this.#breath?.destroy();
    this.#breath = null;
    for (const patch of this.#patches) {
      patch.destroy();
    }
    this.#patches = [];
    for (const effect of this.#steamEffects) {
      effect.destroy();
    }
    this.#steamEffects = [];
    this.animationPlayback?.destroy();
    super.destroy();
  }
}
