import { Enemy } from "../shared/Enemy.js";
import { DisciplineAura } from "./DisciplineAura.js";
import { ShamanCastState } from "./states/ShamanCastState.js";
import { ShamanMarchState } from "./states/ShamanMarchState.js";
import { ShamanInterruptedState } from "./states/ShamanInterruptedState.js";
import { ShamanRecoverState } from "./states/ShamanRecoverState.js";
import { ShamanStaffAttackState } from "./states/ShamanStaffAttackState.js";
import { ShamanDeadState } from "./states/ShamanDeadState.js";
import { ShamanClipTestState } from "./states/ShamanClipTestState.js";
import { MaskShamanVisual } from "./MaskShamanVisual.js";
import { MaskShamanChecks } from "./MaskShamanChecks.js";

/**
 * Small staff-bearing support enemy; discipline suspends existing grudges.
 */
export class MaskShaman extends Enemy {
  /**
   * @type {string}
   */
  static modelUrl = new URL("../../../models/enemies/mask-shaman/mask-shaman.glb", import.meta.url).href;

  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [this.modelUrl];
  }

  /**
   * @param {ConstructorParameters<typeof Enemy>[0]} options
   */
  constructor(options) {
    super(options);

    this.auraRadius = 3.5;
    this.walkSpeed = 0.28;
    this.attackReach = 0.85;
    this.stateTime = 0;
    this.attackTarget = null;
    this.requestedClip = null;
    this.aura = new DisciplineAura(this);
    for (const Type of [ShamanCastState, ShamanMarchState, ShamanInterruptedState,
      ShamanRecoverState, ShamanStaffAttackState, ShamanDeadState, ShamanClipTestState]) {
      this.behavior.add(Type.name, new Type());
    }
    this.visual = this.modelLibrary ? new MaskShamanVisual(this) : null;
    this.checks = new MaskShamanChecks(this);
    this.beginCast();
    if (this.definition.testClip) {
      this.testClip = this.definition.testClip;
    }
  }

  /**
   * Precedence preserves flight even if a bell or hit occurs mid-throw.
   * @returns {string|null}
   */
  get reactionReason() {
    if (this.airborne) {
      return "airborne";
    }
    if (this.carrier) {
      return "carried_struggle";
    }
    if (this.statuses.has("confused")) {
      return "confused_loop";
    }
    if (this.statuses.has("stun")) {
      return "stun_loop";
    }
    if (this.statuses.has("cast_interrupted")) {
      return "hit";
    }
    return null;
  }

  /**
   * @returns {boolean}
   */
  get auraActive() {
    return this.aura.active;
  }

  /**
   * @returns {string}
   */
  get testStatus() {
    return `${super.testStatus}; discipline ${this.auraActive ? "active" : "paused"}; requested ${this.requestedClip}`;
  }

  /**
   * Shared interaction capability for any volatile ally, without sibling imports.
   * @param {Enemy} actor
   * @returns {boolean}
   */
  suppressesGrudgesFor(actor) {
    return this.aura.suppressesGrudgesFor(actor);
  }

  /**
   * Transition the embedded clip without restarting it on every state update.
   * @param {string} name
   */
  requestClip(name) {
    this.requestedClip = name;
    this.visual?.play(name);
  }

  /**
   * @param {string|null} name
   */
  set testClip(name) {
    if (name === null) {
      this.beginCast();

      return;
    }
    this.behavior.changeTo(ShamanClipTestState.name);
    this.requestedClip = name;
    this.visual?.play(name, true);
  }

  onSceneReady() {
    super.onSceneReady();
    if (this.definition.testStageRoyal) {
      this.checks.placeRoyal();
    }
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    super.update(dt);
    this.visual?.drawAura();
  }

  beginCast() {
    this.behavior.changeTo(ShamanCastState.name);
  }

  resumeMarch() {
    this.behavior.changeTo(ShamanMarchState.name);
  }

  beginStaffAttack() {
    this.behavior.changeTo(ShamanStaffAttackState.name);
  }

  beginRecovery() {
    this.behavior.changeTo(ShamanRecoverState.name);
  }

  beginDeath() {
    if (!(this.behavior.currentState instanceof ShamanDeadState)) {
      this.behavior.changeTo(ShamanDeadState.name);
    }
  }

  /**
   * @returns {boolean}
   */
  reconcileReaction() {
    if (!this.alive) {
      this.beginDeath();

      return true;
    }
    if (this.reactionReason) {
      this.aura.active = false;
      if (!(this.behavior.currentState instanceof ShamanInterruptedState)) {
        this.behavior.changeTo(ShamanInterruptedState.name);
      }
      return true;
    }
    return false;
  }

  onDamaged() {
    if (this.alive) {
      this.applyStatus("cast_interrupted", { duration: 0.4 });
    }
  }

  onDeath() {
    this.beginDeath();
  }

  /**
   * @param {string} name
   */
  onStatusApplied(name) {
    if (["confused", "stun", "cast_interrupted"].includes(name)) {
      this.reconcileReaction();
    }
  }

  onCarried() {
    this.reconcileReaction();
    this.requestClip("carried_struggle");
  }

  onLaunched() {
    this.reconcileReaction();
    this.requestClip("airborne");
  }

  onLanded() {
    if (this.reactionReason) {
      this.reconcileReaction();
    } else {
      this.beginRecovery();
      this.requestClip("land");
    }
  }

  destroy() {
    this.aura.active = false;
    this.checks.destroy();
    this.visual = null;
    super.destroy();
  }
}
