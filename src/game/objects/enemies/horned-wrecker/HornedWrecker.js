import { Enemy } from "../shared/Enemy.js";
import { WreckerPursueState } from "./WreckerPursueState.js";
import { WreckerSnortState } from "./WreckerSnortState.js";
import { WreckerStompState } from "./WreckerStompState.js";
import { WreckerRageState } from "./WreckerRageState.js";
import { WreckerRecoverState } from "./WreckerRecoverState.js";
import { WreckerHeadbuttState } from "./WreckerHeadbuttState.js";
import { WreckerStunState } from "./WreckerStunState.js";
import { WreckerDeadState } from "./WreckerDeadState.js";
import { WreckerAnimationPlayback } from "./WreckerAnimationPlayback.js";
import { WreckerPlaybackState } from "./WreckerPlaybackState.js";
import { WreckerChecks } from "./WreckerChecks.js";
import { WreckerBatterState } from "./WreckerBatterState.js";
import { WreckerFistWindupState } from "./WreckerFistWindupState.js";
import { WreckerFistSwingState } from "./WreckerFistSwingState.js";
import { WreckerFistRecoverState } from "./WreckerFistRecoverState.js";
import { WreckerStunRecoverState } from "./WreckerStunRecoverState.js";
import { WreckerCombat } from "./WreckerCombat.js";

/**
 * Huge royal hunter with contact-driven rage and embedded Tripo animation.
 */
export class HornedWrecker extends Enemy {
  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [new URL("../../../models/enemies/horned-wrecker/horned-wrecker.glb", import.meta.url).href];
  }
  /**
   * @param {import("../../ObjectTypes.js").MapObjectOptions} options
   */
  constructor(options) {
    super(options);

    this.bellImmune = true;
    this.statusImmunities = new Set(["confused", "confusion"]);
    this.contactActors = new Set();
    this.contactHandles = [];
    this.combat = new WreckerCombat(this);
    this.radius = 0.7;
    this.height = 2.2;
    if (this.modelLibrary) {
      const model = this.modelLibrary.instantiate(HornedWrecker.modelUrls[0]);
      const wrapper = new this.pc.Entity("Calibrated Wrecker artwork");
      wrapper.setLocalScale(2.6, 2.6, 2.6);
      wrapper.setLocalEulerAngles(0, 180, 0);
      this.entity.addChild(wrapper);
      wrapper.addChild(model);
      this.modelRoot = model;
      this.playback = new WreckerAnimationPlayback(model, this.modelLibrary, HornedWrecker.modelUrls[0]);
      this.checks = new WreckerChecks(this);
    }
    for (const Type of [WreckerPursueState, WreckerSnortState, WreckerStompState,
      WreckerRageState, WreckerRecoverState, WreckerHeadbuttState, WreckerStunState,
      WreckerDeadState, WreckerPlaybackState, WreckerBatterState,
      WreckerFistWindupState, WreckerFistSwingState, WreckerFistRecoverState, WreckerStunRecoverState]) {
      this.behavior.add(Type.name, new Type());
    }
    this.behavior.changeTo(this.definition.verificationIdle ? WreckerPlaybackState.name : WreckerPursueState.name);
  }

  onSceneReady() {
    super.onSceneReady();
    this.entity.rigidbody.mass = 250;
    if (this.contactHandles.length) {
      return;
    }
    this.contactHandles.push(this.entity.collision.on("collisionstart", /**
     *
     * @param {import("playcanvas").ContactResult} result
     */
      (result) => {
        const lateral = result.contacts?.some(/**
         *
         * @param {import("playcanvas").ContactPoint} contact
         */
          (contact) => Math.abs(contact.normal.y) < 0.6);
        if (result.contacts?.length && !lateral) {
          return;
        }
        const actor = this.contactActor(result.other);
        if (actor) {
          this.contactActors.add(actor);
          this.provoke();
        }
      }));
    this.contactHandles.push(this.entity.collision.on("collisionend", /**
     *
     * @param {import("playcanvas").Entity} other
     */
      (other) => {
        const actor = this.contactActor(other);
        this.contactActors.delete(actor);
      }));
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @returns {import("../shared/Enemy.js").EnemyActor|null}
   */
  contactActor(entity) {
    return this.actors.find(/**
     *
     * @param {import("../shared/Enemy.js").EnemyActor} actor
     */
      (actor) => actor !== this && (typeof actor.receiveDamage === "function" || actor.isRoyal) && actor.entity &&
      (actor.entity === entity || entity?.isDescendantOf(actor.entity))) ?? null;
  }

  /**
   * Select an authored clip on the rendered model hierarchy.
   * @param {string} name
   */
  playClip(name) {
    this.requestedClip = name;
    this.playback?.play(name, 1, false);
  }

  /**
   * @param {number} direction
   */
  inspectClip(direction = 1) {
    if (!this.alive) {
      return;
    }
    const names = [...(this.playback?.tracks.keys() ?? [])];
    if (!names.length) {
      return;
    }
    this.behavior.changeTo(WreckerPlaybackState.name);
    const index = names.indexOf(this.requestedClip);
    this.playClip(names[(index + direction + names.length) % names.length]);
  }

  /**
   * @returns {string}
   */
  get testStatus() {
    return `${super.testStatus}\nClip: ${this.requestedClip} ${this.checks?.progress ?? ""}`;
  }

  provoke() {
    if (this.alive && this.behavior.currentState instanceof WreckerPursueState) {
      this.behavior.changeTo(WreckerSnortState.name);
    }
  }

  onBellEncouraged() {
    this.provoke();
  }

  onBumped() {
    this.provoke();
  }

  onDamaged() {
    this.provoke();
  }

  onUnwantedSwap() {
    this.provoke();

    return false;
  }

  /**
   * Reject all bell-derived stun sources, including amplified secondary ringing.
   * @param {string} name
   * @param {{duration?:number,kind?:string,source?:import("../shared/Enemy.js").EnemyActor,bellEventId?:string}} options
   * @returns {boolean}
   */
  applyStatus(name, options = {}) {
    if (name === "stun" && (options.kind === "bell" || options.source?.isBell ||
      options.source?.isBellBug || options.bellEventId !== undefined)) {
      this.provoke();

      return false;
    }
    return super.applyStatus(name, options);
  }

  /**
   * @param {string} name
   */
  onStatusApplied(name) {
    if (name === "stun") {
      this.behavior.changeTo(WreckerStunState.name);
    }
  }

  canBeCarriedBy() {
    return false;
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} carrier
   * @returns {boolean}
   */
  beginCarry(carrier) {
    if (this.alive && !this.statuses.has("stun") &&
      !(this.behavior.currentState instanceof WreckerHeadbuttState)) {
      this.pickupAggressor = carrier;
      this.behavior.changeTo(WreckerHeadbuttState.name);
    } else {
      this.provoke();
    }
    return false;
  }

  launch() {
    return false;
  }

  /**
   * Approach actual entrances before pursuing the royal inside.
   * @param {import("../shared/Enemy.js").EnemyActor} royal
   * @returns {{waypoint?:{position:import("playcanvas").Vec3},door?:import("../../architecture/door/Door.js").Door}}
   */
  entranceRoute(royal) {
    const destination = this.targetPosition(royal);
    if (!destination) {
      return {};
    }
    for (const actor of this.actors) {
      const doors = actor.entranceDoors ?? [];
      if (!doors.length) {
        continue;
      }
      const center = new this.pc.Vec3();
      for (const door of doors) {
        center.add(door.entity.getPosition());
      }
      center.mulScalar(1 / doors.length);
      const inward = destination.clone().sub(center);
      inward.y = 0;
      if (inward.length() < 0.1) {
        continue;
      }
      inward.normalize();
      const offset = this.position.clone().sub(center);
      if (offset.dot(inward) < 0.8) {
        return {
          waypoint: { position: center.add(inward.mulScalar(1.1)) },
          door: doors.find(/**
           *
           * @param {import("../../architecture/door/Door.js").Door} door
           */
            (door) => door.openAmount < 0.75),
        };
      }
    }

    return {};
  }

  beginBattering() {
    if (this.alive && !this.statuses.has("stun")) {
      this.behavior.changeTo(WreckerBatterState.name);
    }
  }

  /**
   * Physical contacts include allies; reaching a royal also requires Ammo visibility.
   * @param {Set<import("../shared/Enemy.js").EnemyActor>} struck
   * @param {number} amount
   */
  strikeContacts(struck = new Set(), amount = 25) {
    this.combat.strike(struck, amount);
  }

  /**
   * @param {new () => import("yuka").State} Type
   */
  advanceAction(Type) {
    const next = Type === WreckerSnortState ? WreckerStompState :
      Type === WreckerStompState ? WreckerRageState :
        Type === WreckerRageState ? WreckerRecoverState :
          Type === WreckerStunState ? WreckerStunRecoverState :
            Type === WreckerFistWindupState ? WreckerFistSwingState :
              Type === WreckerFistSwingState ? WreckerFistRecoverState :
                Type === WreckerRecoverState && this.contactActors.size ? WreckerFistWindupState : WreckerPursueState;
    this.behavior.changeTo(next.name);
  }

  onDeath() {
    this.behavior.changeTo(WreckerDeadState.name);
  }

  destroy() {
    this.checks?.destroy();
    for (const handle of this.contactHandles) {
      handle.off();
    }
    this.contactHandles.length = 0;
    super.destroy();
  }
}
