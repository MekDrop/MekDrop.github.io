import { HookClimbGrip } from "./HookClimbGrip.js";
import { HookClimbState } from "./states/HookClimbState.js";
import { HookConfusedState } from "./states/HookConfusedState.js";
import { HookDetachedState } from "./states/HookDetachedState.js";
import { HookStunnedState } from "./states/HookStunnedState.js";
import { HookCarriedState } from "./states/HookCarriedState.js";
import { HookDeadState } from "./states/HookDeadState.js";
import { HookAttackState } from "./states/HookAttackState.js";
import { HookClingLandingState } from "./states/HookClingLandingState.js";
import { HookMantleState } from "./states/HookMantleState.js";
import { HookInspectState } from "./states/HookInspectState.js";
import { HookRecoverState } from "./states/HookRecoverState.js";
import { Vec3 } from "playcanvas";

/**
 * Installs Hook Gremlin's contact lifecycle on the shared Enemy Yuka machine.
 * The future model-owning leaf forwards shared hooks here and supplies playback.
 * Not registered with the map factory until the Tripo asset is available.
 */
export class HookClimbBehavior {
  /**
   * @type {import("../shared/Enemy.js").Enemy}
   */
  enemy;
  /**
   * @type {HookClimbGrip}
   */
  grip;
  /**
   * @type {{point:Vec3,inward:Vec3,start:Vec3,entity:import("playcanvas").Entity}|null}
   */
  ledge = null;
  /**
   * @type {(clip: string) => void}
   */
  #play;

  /**
   * @param {import("../shared/Enemy.js").Enemy} enemy
   * @param {(clip: string) => void} play
   */
  constructor(enemy, play) {
    this.enemy = enemy;
    this.#play = play;
    this.grip = new HookClimbGrip(enemy);
    for (const Type of [HookClimbState, HookConfusedState, HookDetachedState,
      HookStunnedState, HookCarriedState, HookDeadState, HookAttackState, HookClingLandingState, HookMantleState, HookInspectState, HookRecoverState]) {
      enemy.behavior.add(Type.name, new Type(this));
    }
    this.change(HookDetachedState);
  }

  /**
   * @param {typeof import("yuka").State} Type
   */
  change(Type) {
    if (this.enemy.behavior.currentState?.constructor !== Type) {
      this.enemy.behavior.changeTo(Type.name);
    }
  }

  /**
   * @param {string} clip
   */
  play(clip) {
    this.#play(clip);
  }

  inspect() {
    this.change(HookInspectState);
  }

  resume() {
    if (!this.interrupt()) {
      this.change(this.grip.attached ? HookClimbState : HookDetachedState);
    }
  }

  /**
   * Shared lifecycle has priority over locomotion; bells must never suspend death,
   * enable a disabled carried body, or erase an existing landing stun.
   * @returns {boolean} Whether a higher-priority state took control.
   */
  interrupt() {
    if (!this.enemy.alive) {
      this.change(HookDeadState);

      return true;
    }
    if (this.enemy.carrier) {
      this.change(HookCarriedState);

      return true;
    }
    if (this.enemy.statuses.has("stun")) {
      this.change(HookStunnedState);

      return true;
    }
    if (this.enemy.statuses.has("confused")) {
      this.change(HookConfusedState);

      return true;
    }
    return false;
  }

  /**
   * @param {import("playcanvas").RaycastResult} hit
   * @returns {boolean}
   */
  catchSurface(hit) {
    if (!this.enemy.alive || this.enemy.carrier || this.enemy.statuses.has("stun") ||
      this.enemy.statuses.has("confused") || !this.grip.attach(hit)) {
      return false;
    }
    const wasAirborne = this.enemy.airborne;
    this.enemy.airborne = false;
    this.enemy.grounded = false;
    this.enemy.entity.setEulerAngles(0, Math.atan2(hit.normal.x, hit.normal.z) * 180 / Math.PI, 0);
    this.change(wasAirborne ? HookClingLandingState : HookClimbState);

    return true;
  }

  /**
   * Release before shared beginCarry disables the body.
   */
  onCarried() {
    this.grip.release();
    this.change(HookCarriedState);
  }

  /**
   * @returns {boolean}
   */
  tryAttack() {
    const target = this.enemy.resolveRoyalTarget();
    if (!this.enemy.canReachRoyal?.(target)) {
      return false;
    }
    this.change(HookAttackState);

    return true;
  }

  /**
   * @param {Vec3|null} inward
   * @returns {boolean}
   */
  tryMantle(inward) {
    if (!inward) {
      return false;
    }
    const enemy = this.enemy;
    const from = enemy.position.clone().add(inward.clone().mulScalar(enemy.radius * 2 + 0.3));
    from.y += enemy.height + 0.4;
    const to = from.clone();
    to.y = enemy.position.y - 0.15;
    const hit = enemy.app.systems.rigidbody.raycastFirst(from, to, {
      filterCallback: HookClimbBehavior.#staticSurface,
    });
    if (!hit || hit.normal.y < 0.65 || hit.point.y < enemy.position.y - 0.1) {
      return false;
    }
    this.ledge = {
      entity: hit.entity,
      point: hit.point.clone(),
      inward,
      start: enemy.position.clone(),
    };
    this.grip.release();
    this.change(HookMantleState);

    return true;
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @returns {boolean}
   */
  static #staticSurface(entity) {
    return entity.enabled && entity.rigidbody?.type === "static";
  }

  /**
   * Release before shared launch assigns its engine velocity.
   */
  beforeLaunch() {
    this.grip.release();
  }

  onLaunched() {
    this.change(HookDetachedState);
  }

  /**
   * Called only for an actual shared-body landing, not a nearby surface.
   * @param {{other?:import("playcanvas").Entity}} contact
   */
  onLanded(contact = {}) {
    if (!this.enemy.alive) {
      this.change(HookDeadState);

      return;
    }
    if (this.ledge && contact.other === this.ledge.entity) {
      this.ledge = null;
      this.play("recover");
      this.change(HookDetachedState);

      return;
    }
    this.ledge = null;
    this.grip.release();
    this.enemy.applyStatus("stun", {
      duration: 1.6,
      reason: "missed-land",
    });
    this.change(HookStunnedState);
  }

  onDeath() {
    this.change(HookDeadState);
  }

  destroy() {
    this.grip.release();
  }
}
