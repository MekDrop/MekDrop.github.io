import { BellBugScratchRecoverState } from "./states/BellBugScratchRecoverState.js";
import { BellBugPlaybackVerification } from "./BellBugPlaybackVerification.js";
import { BellBugPreview } from "./BellBugPreview.js";
import { BellBugModel } from "./BellBugModel.js";
import { BellBugPlaybackState } from "./states/BellBugPlaybackState.js";
import { Enemy } from "../shared/Enemy.js";
import { BellBugPursueState } from "./states/BellBugPursueState.js";
import { BellBugPanicState } from "./states/BellBugPanicState.js";
import { BellBugScratchState } from "./states/BellBugScratchState.js";
import { BellBugReactionState } from "./states/BellBugReactionState.js";

/**
 * Cowardly bell beetle. The royal remains its goal; towers are never targets.
 */
export class BellBug extends Enemy {
  /**
   * @type {Set<string|number>}
   */
  #seenRings = new Set();
  /**
   * @type {number}
   */
  #ringSequence = 0;
  /**
   * @type {WeakMap<Enemy,string|number>}
   */
  #amplified = new WeakMap();

  /**
   * @param {import("../../ObjectTypes.js").MapObjectOptions} options
   */
  constructor(options) {
    super(options);

    const position = options.definition.position;
    if (position) {
      this.entity.setPosition(position.x, position.y, position.z);
    }
    this.isBellBug = true;
    this.radius = 0.42;
    this.height = 0.85;
    this.walkSpeed = 1.15;
    this.ringRadius = 5;
    this.ringCount = 0;
    this.clip = "idle_nervous";
    this.phaseTime = 0;
    this.fearEvent = null;
    this.scratchTarget = null;
    for (const Type of [BellBugPursueState, BellBugPanicState, BellBugScratchState, BellBugScratchRecoverState, BellBugReactionState]) {
      this.behavior.add(Type.name, new Type());
    }
    this.behavior.add(BellBugPlaybackState.name, new BellBugPlaybackState());
    this.behavior.changeTo(BellBugPursueState.name);
    if (options.definition.inspection) {
      this.inspectClip("idle_nervous");
    }
    if (options.modelLibrary && this.constructor.modelUrl) {
      this.animationPlayback = new BellBugModel(this, this.constructor.modelUrl);
    }
  }

  onSceneReady() {
    super.onSceneReady();
    const url = this.constructor.audioUrls?.[0];
    if (url && this.runtime.audioLibrary) {
      const asset = this.runtime.audioLibrary.get(url);
      this.entity.addComponent("sound", {
        positional: false,
        slots: {
          fearRing: {
            asset: asset.id,
            volume: 0.35,
            overlap: false,
            loop: false,
          },
        },
      });
    }
  }

  /**
   * @returns {string}
   */
  get testStatus() {
    return `${super.testStatus} | ${this.clip} | rings ${this.ringCount} | stun ${(this.statuses.get("stun")?.remaining ?? 0).toFixed(2)}s`;
  }

  /**
   * @param {string} name
   */
  playClip(name) {
    if (this.clip !== name) {
      this.clip = name;
      this.animationPlayback?.play(name);
    }
  }

  /**
   * @param {string} state
   */
  transition(state) {
    this.behavior.changeTo(state);
  }

  /**
   * Secondary noise never frightens another bug. Bound retained identities.
   * @param {{eventId?:string|number,secondary?:boolean,source?:Enemy,duration?:number}} event
   * @returns {boolean}
   */
  onBellRung(event = {}) {
    if (!this.alive || event.secondary || this.#seenRings.has(event.eventId)) {
      return false;
    }
    const eventId = event.eventId ?? `${this.definition.id}:fear:${++this.#ringSequence}`;
    this.#seenRings.add(eventId);
    if (this.#seenRings.size > 128) {
      this.#seenRings.delete(this.#seenRings.values().next().value);
    }
    this.fearEvent = {
      ...event,
      eventId,
    };
    if (this.carrier || this.airborne) {
      this.ringInFear();

      return true;
    }
    if (!this.carrier && !this.airborne && !this.statuses.has("stun")) {
      this.transition(BellBugPanicState.name);
    }
    return true;
  }

  /**
   * Extend only existing allied stun; never create confusion or a rally buff.
   * Each original event extends a given ally at most once across all bugs.
   */
  ringInFear() {
    if (!this.alive || !this.fearEvent) {
      return;
    }
    const event = this.fearEvent;
    this.fearEvent = null;
    this.ringCount++;
    this.entity.sound?.play("fearRing");
    for (const actor of this.actors) {
      if (actor === this || !actor.isEnemy || !actor.alive || this.distanceTo(actor) > this.ringRadius) {
        continue;
      }
      // Noise irritation is a capability; immune species never receive a status.
      if (actor.bellImmune) {
        if (typeof actor.irritate === "function") {
          actor.irritate(this, "stomp");
        } else {
          actor.onBellEncouraged?.(this);
        }
        continue;
      }
      const stun = actor.statuses?.get("stun");
      if (!(stun?.remaining > 0) || stun.bellAmplifiedEvent === event.eventId) {
        continue;
      }
      const previous = this.#amplified.get(actor);
      if (previous === event.eventId) {
        continue;
      }
      if (actor.applyStatus?.("stun", {
        duration: Math.min(8, stun.remaining + 1.5),
        source: this,
        kind: "bell",
        bellEventId: event.eventId,
        bellAmplifiedEvent: event.eventId,
      })) {
        this.#amplified.set(actor, event.eventId);
      }
    }
    this.runtime.onBellBugRing?.(this, {
      ...event,
      secondary: true,
      source: this,
    });
  }

  /**
   * @param {string} clip
   */
  react(clip) {
    this.reactionClip = clip;
    this.transition(BellBugReactionState.name);
  }

  onCarried() {
    this.fearEvent = { eventId: `${this.definition.id}:grab:${++this.#ringSequence}` };
    this.react("carried_panic");
    this.ringInFear();
  }

  onLaunched() {
    this.react("airborne_tumble");
  }

  onLanded() {
    this.react("land");
  }

  /**
   * @param {string} name
   */
  onStatusApplied(name) {
    if ((name === "stun" || name === "confused") && !this.carrier && !this.airborne) {
      this.react("stun");
    }
  }

  onDamaged() {
    if (this.alive && !this.carrier && !this.airborne && !this.statuses.has("stun")) {
      this.react("hit");
    }
  }

  onDeath() {
    this.fearEvent = null;
    this.react("death");
    if (this.entity.rigidbody) {
      this.entity.rigidbody.enabled = false;
    }
  }

  /**
   * Use real Ammo hits to identify the main-door leaf obstructing the royal.
   * Castle-owned doors remain castle-owned; no renderer special cases.
   * @param {Enemy} royal
   * @returns {import("../../architecture/door/Door.js").Door|null}
   */
  findClosedDoor(royal) {
    const point = this.targetPosition(royal);
    const physics = this.app.systems?.rigidbody;
    if (!point || !physics) {
      return null;
    }
    const start = this.position.clone().add(new this.pc.Vec3(0, 0.4, 0));
    const end = new this.pc.Vec3(point.x, point.y + 0.4, point.z);
    const hits = physics.raycastAll(start, end).sort(/**
     *
     * @param {import("playcanvas").RaycastResult} a
     * @param {import("playcanvas").RaycastResult} b
     */
      (a, b) => a.hitFraction - b.hitFraction);
    const doors = this.actors.flatMap(/**
     *
     * @param {import("../../castle/Castle.js").Castle} actor
     */
      (actor) => actor.entranceDoors ?? []);
    for (const hit of hits) {
      if (hit.entity === this.entity || hit.entity.isDescendantOf(this.entity)) {
        continue;
      }
      return doors.find(/**
       *
       * @param {import("../../architecture/door/Door.js").Door} door
       */
        (door) => door.openAmount < 0.15 &&
        (door.entity === hit.entity || hit.entity.isDescendantOf(door.entity))) ?? null;
    }

    return null;
  }

  /**
   * Contact is checked at the attack frame, never during the windup.
   * @returns {boolean}
   */
  scratchDoor() {
    const royal = this.resolveRoyalTarget();
    const door = royal && this.findClosedDoor(royal);
    if (!door || door !== this.scratchTarget || !this.canScratchDoor) {
      return false;
    }
    // Door destruction requires the owning door's damage capability. Do not
    // destroy its root: it also owns the masonry frame and castle update hooks.
    return (door.receiveDamage?.(8, this, "scratch") ?? 0) > 0;
  }

  /**
   * @returns {boolean}
   */
  get canScratchDoor() {
    const door = this.scratchTarget;

    return !!door && door.openAmount < 0.15 &&
      door.intersectsFootprint(this.position.x, this.position.z, this.radius + 0.4);
  }

  /**
   * @param {string} clip
   */
  inspectClip(clip) {
    this.previewClip = clip;
    this.transition(BellBugPlaybackState.name);
    this.animationPlayback?.restart(clip);
  }

  /**
   * @returns {Promise<{visiblePixels:number,transparentPixels:number,margin:number}>}
   */
  capturePreview() {
    return new BellBugPreview(this).capture();
  }

  /**
   * @returns {Promise<Array<{name:string,finite:boolean,time:number,movingJoints:string[]}>>}
   */
  verifyPlayback() {
    return new BellBugPlaybackVerification(this).run();
  }

  destroy() {
    this.animationPlayback?.destroy();
    super.destroy();
  }
}
