import { Enemy } from "../shared/Enemy.js";
import { divecapClips } from "./DivecapClips.js";
import { DivecapPursueState } from "./states/DivecapPursueState.js";
import { DivecapQueueState } from "./states/DivecapQueueState.js";
import { DivecapCarriedState } from "./states/DivecapCarriedState.js";
import { DivecapFlightState } from "./states/DivecapFlightState.js";
import { DivecapLandingState } from "./states/DivecapLandingState.js";
import { DivecapBonkState } from "./states/DivecapBonkState.js";
import { DivecapStunState } from "./states/DivecapStunState.js";
import { DivecapRecoverState } from "./states/DivecapRecoverState.js";
import { DivecapDeathState } from "./states/DivecapDeathState.js";
import { DivecapInspectState } from "./states/DivecapInspectState.js";
import { DivecapRoute } from "./DivecapRoute.js";
import { DivecapPreview } from "./DivecapPreview.js";
import { DivecapTestActions } from "./DivecapTestActions.js";

/**
 * Cheerful royal raider; the helmet and cap are imported Tripo artwork.
 */
export class Divecap extends Enemy {
  /**
   * @type {string}
   */
  static modelUrl = new URL("../../../models/enemies/divecap/divecap.glb", import.meta.url).href;
  /**
   * @type {string[]}
   */
  static modelUrls = [Divecap.modelUrl];

  /**
   * @type {import("playcanvas").Entity|null}
   */
  #model = null;
  /**
   * @type {number}
   */
  #clipOverrideUntil = 0;
  /**
   * @type {Set<import("../shared/Enemy.js").EnemyActor>}
   */
  #reachedRoyals = new Set();
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #splash = null;
  /**
   * @type {import("playcanvas").EventHandle|null}
   */
  #supportHandle = null;
  /**
   * @type {number}
   */
  #locomotionSpeed = 1.05;
  /**
   * @type {import("playcanvas").Vec3|null}
   */
  #motionPoint = null;
  /**
   * @type {number}
   */
  #motionSpeed = 0;

  /**
   * @param {import("../../ObjectTypes.js").MapObjectOptions} options
   */
  constructor(options) {
    super(options);

    const position = options.definition.position;
    if (position) {
      this.entity.setLocalPosition(position.x, position.y ?? 0, position.z);
    }
    this.radius = 0.24;
    this.height = 1;
    this.bellImmune = true;
    this.encouragedUntil = 0;
    this.phaseStarted = 0;
    this.diveStarted = 0;
    this.lastImpactHits = 0;
    this.requestedAnimation = "idle";
    this.attackTarget = null;
    this.attackContactAt = Infinity;
    this.route = new DivecapRoute(this);
    this.testActions = new DivecapTestActions(this);
    for (const StateClass of [DivecapPursueState, DivecapQueueState, DivecapCarriedState,
      DivecapFlightState, DivecapLandingState, DivecapBonkState, DivecapStunState,
      DivecapRecoverState, DivecapDeathState, DivecapInspectState]) {
      this.behavior.add(StateClass.name, new StateClass());
    }
    if (this.modelLibrary) {
      this.#model = this.modelLibrary.instantiate(Divecap.modelUrl);
      // glTF faces +Z; the semantic root moves along -Z.
      this.#model.setLocalEulerAngles(0, 180, 0);
      this.entity.addChild(this.#model);
      const tracks = this.modelLibrary.getAnimationTracks(Divecap.modelUrl,
        divecapClips.map(Divecap.#clipName));
      this.#model.addComponent("anim", { activate: true });
      for (const clip of divecapClips) {
        this.#model.anim.addAnimationState(clip.name, tracks.get(clip.name), 1, clip.loop);
      }
      this.#model.anim.baseLayer.play("idle");
    }
    this.changeState(options.definition.testInspect ? DivecapInspectState.name : DivecapPursueState.name);
  }

  /**
   *
   * @returns {string}
   */
  get testStatus() {
    return `${super.testStatus}\nClip: ${this.requestedAnimation}; splash hits: ${this.lastImpactHits}`;
  }

  onSceneReady() {
    if (this.#supportHandle) {
      return;
    }
    super.onSceneReady();
    this.#supportHandle = this.entity.rigidbody.on("contact", this.#onSupportContact, this);
  }

  /**
   * PlayCanvas 2.21 copies the contact normal unchanged for the reverse body
   * event. Use the actual foot contact and an engine ray, independent of pair
   * ordering; ceiling and wall contacts cannot become a landing.
   * @param {import("playcanvas").ContactResult} result
   */
  #onSupportContact(result) {
    if (!this.airborne || this.entity.rigidbody.linearVelocity.y > 0.25) {
      return;
    }
    const supported = result.contacts.some(this.#isFootContact.bind(this));
    if (supported) {
      this.onLanding({ other: result.other });
    }
  }

  /**
   * @param {import("playcanvas").ContactPoint} contact @returns {boolean}
   */
  #isFootContact(contact) {
    return Math.abs(contact.normal.y) > 0.5 && contact.point.y <= this.position.y + this.radius + 0.05;
  }

  /**
   * @param {{other?:import("playcanvas").Entity}} contact @returns {boolean}
   */
  onLanding(contact = {}) {
    if (contact.other && (this.entity.rigidbody.linearVelocity.y > 0.25 || !this.#hasFootSupport())) {
      return false;
    }
    return super.onLanding(contact);
  }

  /**
   * @returns {boolean}
   */
  #hasFootSupport() {
    const from = this.position.clone();
    const to = this.position.clone();
    from.y += 0.1;
    to.y -= 0.2;
    const hits = this.app.systems.rigidbody.raycastAll(from, to);

    return hits.some(this.#isSupportHit.bind(this));
  }

  /**
   * @param {import("playcanvas").RaycastResult} hit @returns {boolean}
   */
  #isSupportHit(hit) {
    return hit.normal.y > 0.5 && hit.entity !== this.entity && !hit.entity.isDescendantOf(this.entity);
  }

  /**
   *
   * @returns {Enemy|null}
   */
  get nearestPitcher() {
    const candidates = this.actors.filter(Divecap.#isPitcher);
    candidates.sort(/**
     *
     * @param {Enemy} a
     *
   * @param {Enemy} b
     */
      (a, b) => this.distanceTo(a) - this.distanceTo(b));

    return candidates[0] ?? null;
  }

  /**
   *
   * @returns {boolean}
   */
  get hasOpenRoyalEntrance() {
    // Actual exterior leaf positions and opening state, never a castle damage target.
    const royal = this.resolveRoyalTarget();
    if (!royal) {
      return false;
    }
    const castles = this.actors.filter(Divecap.#isCastle);
    const castle = castles[royal.definition?.castleIndex ?? 0];

    return castle?.entranceDoors.some(Divecap.#isOpenDoor) ?? false;
  }

  /**
   * @param {string} state
   */
  changeState(state) {
    if (this.stateName !== state) {
      this.behavior.changeTo(state);
    }
  }

  /**
   * @param {string} name
   * @param {boolean} restart
   */
  playClip(name, restart = false) {
    if (this.elapsed < this.#clipOverrideUntil) {
      return;
    }
    if (this.#model) {
      this.#model.anim.speed = name === "walk" ? this.#locomotionSpeed / 0.65 : name === "run" ? this.#locomotionSpeed / 1.44 : 1;
    }
    if (this.requestedAnimation === name && !restart) {
      return;
    }
    this.requestedAnimation = name;
    this.#model?.anim.baseLayer.transition(name, restart ? 0 : 0.1);
  }

  /**
   * Map HUD inspection only; exercise embedded clips without replacing gameplay states.
   * @param {string|null} name
   */
  testPlayClip(name) {
    if (!this.alive || this.carrier || this.airborne) {
      return;
    }
    this.#clipOverrideUntil = 0;
    if (name === null) {
      this.changeState(DivecapPursueState.name);

      return;
    }
    const clip = divecapClips.find(/**
     *
     * @param {{name:string}} entry
     */
      (entry) => entry.name === name);
    if (!clip) {
      return;
    }
    this.playClip(name, true);
    if (this.#model) {
      this.#model.anim.speed = 1;
    }
    this.changeState(DivecapInspectState.name);
  }

  /**
   * @returns {Promise<{visiblePixels:number,transparentPixels:number,margin:number}>}
   */
  capturePreview() {
    return new DivecapPreview(this).capture();
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    if (Number.isFinite(dt) && dt > 0) {
      const point = this.position;
      if (this.#motionPoint) {
        const distance = Math.hypot(point.x - this.#motionPoint.x, point.z - this.#motionPoint.z);
        // Teleports are test/carry lifecycle operations, not locomotion strides.
        const measured = distance < 0.5 ? Math.min(3, distance / dt) : 0;
        this.#motionSpeed = distance < 0.5 ? (this.#motionSpeed + measured) / 2 : 0;
      }
      this.#motionPoint ??= point.clone();
      this.#motionPoint.copy(point);
    }
    super.update(dt);
    if (this.#splash && this.elapsed >= this.splashEndsAt) {
      this.#splash.destroy();
      this.#splash = null;
    }
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} actor
   */
  walkTo(actor) {
    if (this.elapsed < this.#clipOverrideUntil) {
      this.stop();

      return;
    }
    const destination = this.targetPosition(actor);
    if (!destination) {
      this.stop();

      return;
    }
    const waypoint = this.route.next(destination);
    if (!waypoint) {
      this.stop();
      this.playClip("queue_wait");

      return;
    }
    const encouraged = this.elapsed < this.encouragedUntil;
    if (this.moveToward({ position: waypoint }, encouraged ? 1.8 : 1.05)) {
      this.#locomotionSpeed = this.#motionSpeed;
      this.playClip(encouraged ? "run" : "walk");
    }
  }

  /**
   * @param {Enemy} pitcher
   * @returns {import("playcanvas").Vec3}
   */
  queuePosition(pitcher) {
    const queue = this.actors.filter(/**
     *
     * @param {Enemy} actor
     */
      (actor) => actor.enemyType === this.enemyType && actor.alive && !actor.carrier && !actor.airborne);
    queue.sort(Divecap.#compareIds);
    const index = Math.max(0, queue.indexOf(this));
    const forward = pitcher.entity.forward.clone().mulScalar(-1.2 - index * 0.65);

    return pitcher.position.clone().add(forward);
  }

  /**
   * @param {Enemy} carrier
   * @returns {boolean}
   */
  isWillingToBeThrownBy(carrier) {
    return Divecap.#isPitcher(carrier) && this.alive && !this.statuses.has("stun") && this.stateName !== DivecapInspectState.name;
  }

  onBellEncouraged() {
    this.encouragedUntil = this.elapsed + 5;
    if (!this.carrier && !this.airborne && this.alive && !this.statuses.has("stun")) {
      this.changeState(this.nearestPitcher ? DivecapQueueState.name : DivecapPursueState.name);
      this.playClip("eager_hop", true);
      this.#clipOverrideUntil = this.elapsed + 0.7;
    }
  }

  onCarried() {
    this.#clipOverrideUntil = 0;
    this.changeState(DivecapCarriedState.name);
  }

  onLaunched() {
    this.#clipOverrideUntil = 0;
    this.changeState(DivecapFlightState.name);
  }

  onLanded() {
    if (this.alive) {
      this.changeState(DivecapLandingState.name);
    }
  }

  /**
   * @param {string} name
   */
  onStatusApplied(name) {
    if (["stun", "confused"].includes(name) && !this.carrier && !this.airborne) {
      this.#clipOverrideUntil = 0;
      this.changeState(DivecapStunState.name);
    }
  }

  onDamaged() {
    if (this.alive && !this.carrier && !this.airborne && !this.statuses.has("stun")) {
      this.playClip("hit", true);
      this.#clipOverrideUntil = this.elapsed + 0.4;
    }
  }

  onDeath() {
    this.#clipOverrideUntil = 0;
    this.changeState(DivecapDeathState.name);
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor|null} royal @returns {boolean}
   */
  canBonk(royal) {
    return !!royal && this.distanceTo(royal) < 0.85 && this.#clearImpact(royal);
  }

  /**
   * Damage the actual person, or use the existing royal game-over capability.
   * @param {import("../shared/Enemy.js").EnemyActor} royal
   * @param {number} damage
   *
   * @returns {boolean}
   */
  strikeRoyal(royal, damage) {
    if (royal.alive === false || !this.#clearImpact(royal)) {
      return false;
    }
    if (typeof royal.receiveDamage === "function") {
      return royal.receiveDamage(damage, this, "dive") > 0;
    }
    if (typeof royal.beginGameOver === "function" && !this.#reachedRoyals.has(royal)) {
      this.#reachedRoyals.add(royal);
      royal.beginGameOver(() => this.position.clone());

      return true;
    }
    return false;
  }

  splashImpact() {
    this.lastImpactHits = 0;
    for (const actor of this.actors) {
      const royal = actor.isRoyal === true || typeof actor.beginGameOver === "function";
      if (!royal || this.distanceTo(actor) > 1.5) {
        continue;
      }
      this.lastImpactHits += Number(this.strikeRoyal(actor, 24));
    }
    // Transient dust spray is dynamic VFX, not a replacement for the imported model.
    if (!this.app.graphicsDevice) {
      return;
    }
    this.#splash?.destroy();
    this.#splash = new this.pc.Entity("Divecap impact splash");
    this.#splash.setPosition(this.position);
    this.#splash.addComponent("particlesystem", {
      numParticles: 22,
      lifetime: 0.45,
      rate: 0.001,
      loop: false,
      emitterExtents: new this.pc.Vec3(0.12, 0.02, 0.12),
      localVelocityGraph: new this.pc.CurveSet([0, -2, 1, -1], [0, 2.5, 1, 0], [0, -2, 1, -1]),
      localVelocityGraph2: new this.pc.CurveSet([0, 2, 1, 1], [0, 4, 1, 0], [0, 2, 1, 1]),
      scaleGraph: new this.pc.Curve([0, 0.07, 1, 0]),
      colorGraph: new this.pc.CurveSet([0, 1], [0, 0.92], [0, 0.75]),
      alphaGraph: new this.pc.Curve([0, 0.9, 1, 0]),
    });
    this.app.root.addChild(this.#splash);
    this.splashEndsAt = this.elapsed + 0.5;
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} actor
   * @returns {boolean}
   */
  #clearImpact(actor) {
    const origin = this.position.clone();
    const destination = this.targetPosition(actor).clone();
    // Royal roots are at the feet. Aim at the exposed seated body rather than
    // letting the throne's low seat falsely shield a nearby splash.
    origin.y += 0.55;
    destination.y += 0.65;
    const hits = this.app.systems?.rigidbody?.raycastAll?.(origin, destination) ?? [];

    return !hits.some(/**
     *
     * @param {{entity:import("playcanvas").Entity}} hit
     */
      (hit) => hit.entity !== this.entity && hit.entity !== actor.entity && !hit.entity.isDescendantOf?.(actor.entity));
  }

  destroy() {
    this.#supportHandle?.off();
    this.#supportHandle = null;
    this.#splash?.destroy();
    this.#splash = null;
    super.destroy();
  }

  /**
   * @param {{name:string}} clip
   * @returns {string}
   */
  static #clipName(clip) {
    return clip.name;
  }

  /**
   * @param {Enemy} actor
   * @returns {boolean}
   */
  static #isPitcher(actor) {
    return actor?.alive === true && typeof actor.pickUp === "function" && typeof actor.isWillingPassenger === "function";
  }

  /**
   * @param {{entranceDoors?:Array<{openAmount:number}>}} actor
   * @returns {boolean}
   */
  static #isCastle(actor) {
    return Array.isArray(actor.entranceDoors);
  }

  /**
   * @param {{openAmount:number}} door
   * @returns {boolean}
   */
  static #isOpenDoor(door) {
    return door.openAmount >= 0.85;
  }

  /**
   * @param {Enemy} a @param {Enemy} b
   * @returns {number}
   * @param {Enemy} b
   */
  static #compareIds(a, b) {
    return a.definition.id.localeCompare(b.definition.id);
  }
}
