import { BellBugDoorScratch } from "./BellBugDoorScratch.js";
import { LatchSlugAudio } from "../../../audio/latch-slug/LatchSlugAudio.js";
import { BellBugScoop } from "./BellBugScoop.js";
import { BellBugScratchRecoverState } from "./states/BellBugScratchRecoverState.js";
import { BellBugPlaybackVerification } from "./BellBugPlaybackVerification.js";
import { BellBugPreview } from "./BellBugPreview.js";
import { BellBugModel } from "./BellBugModel.js";
import { BellBugCalibration } from "./BellBugCalibration.js";
import { BellBugCrowdMotion } from "./BellBugCrowdMotion.js";
import { BellBugRoute } from "./BellBugRoute.js";
import { BellBugStepSupport } from "./BellBugStepSupport.js";
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
   * Foot room used by nearby creatures, separate from the body collider.
   * @returns {number}
   */
  get footprintRadius() {
    return BellBugCalibration.spacingRadius;
  }
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
    this.scoop = new BellBugScoop(this);
    this.doorScratch = new BellBugDoorScratch(this);
    this.radius = BellBugCalibration.radius;
    this.height = BellBugCalibration.height;
    this.stepSupport = new BellBugStepSupport(this);
    this.crowdMotion = new BellBugCrowdMotion(this);
    this.route = new BellBugRoute(this);
    this.walkSpeed = 1.15;
    this.ringRadius = 1;
    this.panicDuration = 2;
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
      for (const [name, source] of [["gooPress", LatchSlugAudio.scoopPress], ["gooPull", LatchSlugAudio.scoopPull], ["gooSwallow", LatchSlugAudio.scoopTaste]]) {
        this.entity.sound.addSlot(name, {
          asset: this.runtime.audioLibrary.get(source.wavUrl).id,
          volume: 0.6,
          overlap: false,
          loop: false,
        });
      }
    }
  }

  /**
   * @param {string} name
   * @param {number} pitch
   */
  playGooSound(name, pitch = 1) {
    const sound = this.entity.sound;
    const slot = sound?.slot(name);
    if (slot) {
      slot.pitch = pitch;
      sound.play(name);
    }
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor|null} target
   * @param {number} speed
   * @param {number} arrivalRadius
   */
  moveToward(target, speed = this.walkSpeed, arrivalRadius = 0.05) {
    const previousYaw = this.entity.getEulerAngles().y;
    const moving = super.moveToward(target, speed, arrivalRadius);
    if (moving) {
      if (!this.crowdMotion.constrain()) {
        this.stop();

        return false;
      }
      const velocity = this.entity.rigidbody.linearVelocity;
      this.stepSupport.advance(velocity);
      this.entity.setEulerAngles(0, Math.atan2(-velocity.x, -velocity.z) * 180 / Math.PI, 0);
      const difference = (this.entity.getEulerAngles().y - previousYaw + 540) % 360 - 180;
      // Sync deliberate turns, not every frame: teleporting an interpolated
      // dynamic body's position continuously discards part of its travel.
      if (Math.abs(difference) > 2) {
        this.faceTarget({ position: this.position.clone().add(velocity.clone().mulScalar(0.1)) });
      }
    }
    return moving;
  }

  /**
   * @returns {string}
   */
  get testStatus() {
    return `${super.testStatus} | ${this.clip} | goo ${this.doorScratch.gooStrokes} | gouges ${this.doorScratch.woodStrokes} | rings ${this.ringCount} | stun ${(this.statuses.get("stun")?.remaining ?? 0).toFixed(2)}s`;
  }

  /**
   * Scratch living actors only while grounded and actively pursuing.
   * @param {number} dt
   */
  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) {
      return;
    }
    super.update(dt);
    this.scoop.update(dt, this.stateName === BellBugPursueState.name);
    if (this.scoop.target) {
      return;
    }
    if (!this.alive || this.carrier || this.airborne ||
      this.statuses.has("stun") || this.stateName !== BellBugPursueState.name) {
      return;
    }
    for (const actor of this.actors) {
      if (actor === this || actor.isEnemy || typeof actor.receiveDamage !== "function" ||
        this.distanceTo(actor) > this.radius + (actor.radius ?? 0.3) + 0.15) {
        continue;
      }
      const point = this.targetPosition(actor);
      const start = this.position.clone().add(new this.pc.Vec3(0, 0.4, 0));
      const end = point.clone().add(new this.pc.Vec3(0, 0.4, 0));
      const hits = this.app.systems?.rigidbody?.raycastAll(start, end) ?? [];
      const blocked = hits.some(/**
       *
       * @param {import("playcanvas").RaycastResult} hit
       */
        (hit) => hit.entity !== this.entity &&
        !hit.entity.isDescendantOf(this.entity) && hit.entity !== actor.entity &&
        !hit.entity.isDescendantOf(actor.entity));
      if (!blocked) {
        this.playClip("scratch_attack");
        actor.receiveDamage(dt / 10, this, "scratch");
      }
    }
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
    this.panicDuration = 2;
    let bonus = 0.2;
    for (const actor of this.actors) {
      if (actor !== this && actor.isBellBug && actor.alive && this.distanceTo(actor) <= this.ringRadius) {
        this.panicDuration += bonus;
        bonus *= 0.1;
      }
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
   * One tile of vibration applies a shared, nonrecursive stun per bell event.
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
      if (actor === this || this.distanceTo(actor) > this.ringRadius) {
        continue;
      }
      actor.slowReaction?.(this.panicDuration, 0.5);
      if (!actor.isEnemy || !actor.alive || actor.isBellBug) {
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
      if (stun?.bellAmplifiedEvent === event.eventId && stun.remaining >= this.panicDuration) {
        continue;
      }
      const previous = this.#amplified.get(actor);
      if (previous === event.eventId) {
        continue;
      }
      if (actor.applyStatus?.("stun", {
        duration: this.panicDuration,
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
    const doors = this.doorOwners.flatMap(/**
     *
     * @param {import("../../castle/Castle.js").Castle} actor
     */
      (actor) => actor.destructibleDoors ?? actor.entranceDoors ?? []);
    for (const hit of hits) {
      if (hit.entity === this.entity || hit.entity.isDescendantOf(this.entity)) {
        continue;
      }
      return doors.find(/**
       *
       * @param {import("../../architecture/door/Door.js").Door} door
       */
        (door) => door.openAmount < 0.15 &&
        (door.isLeafCollider?.(hit.entity) || door.entity === hit.entity || hit.entity.isDescendantOf(door.entity))) ?? null;
    }

    return null;
  }

  /**
   * Goo cleanup targets the nearby door itself, independently of the royal's
   * sightline. Batched door colliders need the owning door's identity query.
   * @returns {import("../../architecture/door/Door.js").Door|null}
   */
  findGluedDoor() {
    let nearest = null;
    let distance = 3;
    for (const actor of this.doorOwners) {
      for (const door of actor.destructibleDoors ?? actor.entranceDoors ?? []) {
        if (!door.jammed || door.broken || door.openAmount >= 0.15) {
          continue;
        }
        const point = this.#doorSurface(door);
        const candidate = point ? this.position.distance(point) : Infinity;
        if (candidate < distance) {
          nearest = door;
          distance = candidate;
        }
      }
    }

    return nearest;
  }

  /**
   * Sample beside a double door's empty center seam and reject intervening walls.
   * @param {import("../../architecture/door/Door.js").Door} door
   * @returns {import("playcanvas").Vec3|null}
   */
  #doorSurface(door) {
    const center = door.entity.getPosition();
    if (Math.abs(center.y - this.position.y) > 1.25) {
      return null;
    }
    const start = this.position.clone().add(new this.pc.Vec3(0, 0.4, 0));
    for (const offset of [0.25, -0.25, 0]) {
      const end = center.clone().add(new this.pc.Vec3(0, 0.4, 0))
        .add(door.entity.right.clone().mulScalar(offset));
      end.add(end.clone().sub(start).normalize().mulScalar(0.25));
      const surface = door.getHit?.(start, end);
      if (door.getHit && !surface) {
        continue;
      }
      const point = surface ? start.clone().lerp(start, end, surface.distance) : end;
      const hits = this.app.systems?.rigidbody?.raycastAll(start, point) ?? [];
      const blocked = hits.some(/**
       * @param {import("playcanvas").RaycastResult} hit
       */
        (hit) => hit.entity !== this.entity && !hit.entity.isDescendantOf(this.entity) &&
          hit.entity.rigidbody?.type !== "dynamic" &&
          !door.isLeafCollider?.(hit.entity) && hit.entity !== door.entity && !hit.entity.isDescendantOf(door.entity));
      if (!blocked) {
        return point;
      }
    }

    return null;
  }

  /**
   * Contact is checked at the attack frame, never during the windup.
   * @returns {boolean}
   */
  scratchDoor() {
    const door = this.scratchTarget;
    if (!door || !this.canScratchDoor) {
      return false;
    }
    return this.doorScratch.apply();
  }

  /**
   * @returns {boolean}
   */
  get canScratchDoor() {
    const door = this.scratchTarget;

    if (!door || door.broken || door.openAmount >= 0.15) {
      return false;
    }
    const point = this.#doorSurface(door);

    return !!point && this.position.distance(point) <= this.radius + 0.4 &&
      (door.blocksCameraAt?.(this.position.x, this.position.y + 0.4, this.position.z, this.radius + 0.4) ??
        door.intersectsFootprint(this.position.x, this.position.z, this.radius + 0.4));
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
    this.scoop.reset();
    this.doorScratch.destroy();
    this.animationPlayback?.destroy();
    super.destroy();
  }
}
