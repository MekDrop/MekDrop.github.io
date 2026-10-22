import { Enemy } from "../shared/Enemy.js";
import { RiftcapSpellbook } from "./RiftcapSpellbook.js";
import { RiftcapAnimation } from "./RiftcapAnimation.js";
import { RiftcapPursueState } from "./states/RiftcapPursueState.js";
import { RiftcapWindupState } from "./states/RiftcapWindupState.js";
import { RiftcapCastState } from "./states/RiftcapCastState.js";
import { RiftcapRecoverState } from "./states/RiftcapRecoverState.js";
import { RiftcapReactionState } from "./states/RiftcapReactionState.js";
import { RiftcapCarriedState } from "./states/RiftcapCarriedState.js";
import { RiftcapAirborneState } from "./states/RiftcapAirborneState.js";
import { RiftcapLandState } from "./states/RiftcapLandState.js";
import { RiftcapDeathState } from "./states/RiftcapDeathState.js";
import { RiftcapHitState } from "./states/RiftcapHitState.js";
import { RiftcapClipTestState } from "./states/RiftcapClipTestState.js";
import { RiftcapPreview } from "./RiftcapPreview.js";
import { RiftcapChecks } from "./RiftcapChecks.js";

/**
 * Purple combat healer using locally rigged and animated Tripo artwork.
 * Owns its spells and Yuka lifecycle without enemy-specific renderer hooks.
 */
export class Riftcap extends Enemy {
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #model = null;
  /**
   * @type {boolean}
   */
  #destroyed = false;
  /**
   * @type {Map<string,number>}
   */
  #durations = new Map();

  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [new URL("../../../models/enemies/riftcap/riftcap.glb", import.meta.url).href];
  }

  /**
   * @param {ConstructorParameters<typeof Enemy>[0]} options
   */
  constructor(options) {
    super(options);

    this.radius = 0.32;
    this.height = 1.15;
    this.spells = new RiftcapSpellbook(this);
    this.checks = new RiftcapChecks(this);
    this.shots = new Set();
    this.pendingCast = null;
    this.clip = "idle";
    this.testPaused = options.definition.testPaused === true;
    for (const Type of [RiftcapPursueState, RiftcapWindupState, RiftcapCastState,
      RiftcapRecoverState, RiftcapReactionState, RiftcapCarriedState,
      RiftcapAirborneState, RiftcapLandState, RiftcapDeathState, RiftcapHitState, RiftcapClipTestState]) {
      this.behavior.add(Type.name, new Type());
    }
    this.behavior.changeTo(RiftcapPursueState.name);
  }

  /**
   * @returns {import("./RiftcapTimeLease.js").RiftcapTemporalActor[]}
   */
  get temporalActors() {
    const actors = new Set(this.combatActors);
    for (const actor of this.actors) {
      for (const shot of actor.shots ?? []) {
        actors.add(shot);
      }
    }
    for (const shot of this.runtime.projectiles ?? []) {
      actors.add(shot);
    }

    return [...actors];
  }

  /**
   * Hero is owned outside the map-object registry; include its existing actor
   * capabilities without importing the class or changing the shared base.
   * @returns {import("../shared/Enemy.js").EnemyActor[]}
   */
  get combatActors() {
    const actors = new Set(this.actors);
    const hero = this.runtime.getHero?.();
    if (hero) {
      actors.add(hero);
    }

    return [...actors];
  }

  /**
   * @returns {string}
   */
  get testStatus() {
    return `${super.testStatus} | ${this.clip} | bubble unsupported: ${this.spells.bubble?.unsupportedActors.size ?? 0}`;
  }

  get modelRoot() {
    return this.#model;
  }

  get clipDurations() {
    return this.#durations;
  }

  /**
   * @returns {{clip:string,time:number,speed:number}}
   */
  get animationStatus() {
    return {
      clip:this.clip,
      time:this.#model?.anim.baseLayer.activeStateCurrentTime ?? 0,
      speed:this.#model?.anim.speed ?? 1,
    };
  }

  /**
   * @param {{download?:boolean}} options
   */
  capturePreview(options = {}) {
    return RiftcapPreview.capture(this, options);
  }

  /**
   * @param {string} name
   */
  testPlayClip(name) {
    if (!RiftcapAnimation.names.includes(name) || !this.alive) {
      return false;
    }
    this.behavior.changeTo(RiftcapClipTestState.name);
    this.clip = name;
    if (this.#model) {
      this.#model.anim.speed = 1;
      this.#model.anim.baseLayer.transition(name, 0);
    }

    return true;
  }

  /**
   * @param {number} direction
   */
  testCycleClip(direction = 1) {
    if (!this.alive || this.carrier || this.airborne || this.statuses.has("confused") || this.statuses.has("stun")) {
      return;
    }
    const names = RiftcapAnimation.names;
    const index = (names.indexOf(this.clip) + direction + names.length) % names.length;
    this.testPlayClip(names[index]);
  }

  onSceneReady() {
    const url = Riftcap.modelUrls[0];
    this.#model = this.modelLibrary.instantiate(url);
    this.entity.addChild(this.#model);
    this.#model.setLocalEulerAngles(0, 180, 0);
    this.#model.addComponent("anim", { activate: true });
    const tracks = this.modelLibrary.getAnimationTracks(url, RiftcapAnimation.names);
    const loops = new Set(["idle", "walk", "run", "heal_loop", "time_bubble_sustain", "confused", "stunned", "carried_struggle", "airborne"]);
    for (const [name, track] of tracks) {
      this.#model.anim.addAnimationState(name, track, 1, loops.has(name));
      this.#durations.set(name, track.duration);
    }
    this.#model.anim.baseLayer.play(this.clip);
    super.onSceneReady();
    if (this.definition.testDiagnostics && typeof window !== "undefined") {
      window.riftcapTest = this;
    }
  }

  /**
   * @param {string} name
   */
  playClip(name) {
    if (this.clip === name) {
      return;
    }
    this.clip = name;
    if (this.#model) {
      const duration = name.endsWith("_windup") || name === "heal_start" || name === "time_bubble_start" ? 0.45 :
        name.endsWith("_cast") ? 0.18 : name.endsWith("_recover") || name.endsWith("_end") ? 0.4 : null;
      this.#model.anim.speed = duration ? this.#durations.get(name) / duration : 1;
    }
    this.#model?.anim?.baseLayer.transition(name, 0.12);
  }

  /**
   * @returns {{name:string, target:import("../shared/Enemy.js").EnemyActor|null}|null}
   */
  chooseSpell() {
    if (this.testPaused || !this.alive || this.carrier || this.airborne) {
      return null;
    }
    const allies = this.spells.allies();
    const wounded = allies.find(/**
     *
     * @param {import("../shared/Enemy.js").EnemyActor} actor
     */
      (actor) => actor.health < actor.maxHealth && this.spells.visible(actor));
    if (this.spells.ready("heal") && wounded) {
      return {
        name: "heal",
        target: wounded,
      };
    }
    const escape = allies.find(/**
     *
     * @param {import("../shared/Enemy.js").EnemyActor} actor
     */
      (actor) => this.spells.canSwap(actor));
    if (this.spells.ready("swap") && this.health < this.maxHealth * 0.35 && escape) {
      return {
        name: "swap",
        target: escape,
      };
    }
    // Only immediate defenders qualify, never distant towers as strategic goals.
    const defender = this.actors.find(/**
     *
     * @param {import("../shared/Enemy.js").EnemyActor} actor
     */
      (actor) => actor !== this && actor.alive !== false &&
      !actor.isEnemy && (actor.isDefender || actor.isCreature || actor.isTower || actor.definition?.isTower) &&
      typeof actor.receiveDamage === "function" && this.distanceTo(actor) <= 3 && this.spells.visible(actor));
    if (defender && this.spells.ready("shatter") && this.distanceTo(defender) <= 1.5) {
      return {
        name: "shatter",
        target: defender,
      };
    }
    if (defender && this.spells.ready("time_bubble")) {
      return {
        name: "time_bubble",
        target: defender,
      };
    }
    const wardTarget = allies.find(/**
     *
     * @param {import("../shared/Enemy.js").EnemyActor} actor
     */
      (actor) => this.spells.visible(actor));
    if (defender && wardTarget && this.spells.ready("ward")) {
      return {
        name: "ward",
        target: wardTarget,
      };
    }
    const target = defender ?? this.resolveRoyalTarget();
    if (this.spells.ready("bolt") && target && this.distanceTo(target) <= 6 && this.spells.visible(target)) {
      return {
        name: "bolt",
        target,
      };
    }
    return null;
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    if (this.#destroyed || !Number.isFinite(dt) || dt <= 0) {
      return;
    }
    this.spells.update(dt);
    super.update(dt);
  }

  /**
   * Saved-map HUD entry point. Uses the real windup/contact/recovery states.
   * @param {string} name
   * @param {string|null} targetId
   */
  testCast(name, targetId = null) {
    if (!["bolt", "swap", "heal", "ward", "shatter", "time_bubble"].includes(name) ||
      !this.alive || this.carrier || this.airborne || this.statuses.has("confused") || this.statuses.has("stun")) {
      return false;
    }
    const target = this.actors.find(/**
     *
     * @param {import("../shared/Enemy.js").EnemyActor} actor
     */
      (actor) => actor.definition?.id === targetId) ??
      (name === "bolt" ? this.resolveRoyalTarget() : this.spells.allies()[0]) ?? null;
    this.pendingCast = {
      name,
      target,
    };
    this.behavior.changeTo(RiftcapWindupState.name);

    return true;
  }

  /**
   * @param {string} name
   */
  onStatusApplied(name) {
    if (["confused", "stun", "knockback"].includes(name)) {
      this.spells.collapseBubble();
      if (!this.carrier && !this.airborne) {
        this.behavior.changeTo(RiftcapReactionState.name);
      }
    }
  }

  onCarried() {
    this.behavior.changeTo(RiftcapCarriedState.name);
  }

  onLaunched() {
    this.behavior.changeTo(RiftcapAirborneState.name);
  }

  /**
   * A floor contact can persist for the first simulation step after launch.
   * @param {{other?: import("playcanvas").Entity}} contact
   */
  onLanding(contact = {}) {
    if (this.entity.rigidbody?.linearVelocity.y > 0.1) {
      return false;
    }

    return super.onLanding(contact);
  }

  onLanded() {
    this.behavior.changeTo(RiftcapLandState.name);
  }

  onDamaged() {
    if (this.alive && !this.carrier && !this.airborne && !this.statuses.has("confused") &&
      !this.statuses.has("stun") && !this.statuses.has("knockback")) {
      this.behavior.changeTo(RiftcapHitState.name);
    }
  }

  onDeath() {
    this.behavior.changeTo(RiftcapDeathState.name);
  }

  destroy() {
    if (this.#destroyed) {
      return;
    }
    this.#destroyed = true;
    if (typeof window !== "undefined" && window.riftcapTest === this) {
      delete window.riftcapTest;
    }
    this.spells.destroy();
    for (const shot of this.shots) {
      shot.destroy();
    }
    super.destroy();
  }
}
