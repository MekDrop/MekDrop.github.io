import { Enemy } from "../shared/Enemy.js";
import { DoorcrackerPursueState } from "./states/DoorcrackerPursueState.js";
import { DoorcrackerBraceState } from "./states/DoorcrackerBraceState.js";
import { DoorcrackerFuseState } from "./states/DoorcrackerFuseState.js";
import { DoorcrackerDetonateState } from "./states/DoorcrackerDetonateState.js";
import { DoorcrackerReactionState } from "./states/DoorcrackerReactionState.js";
import { DoorcrackerCarriedState } from "./states/DoorcrackerCarriedState.js";
import { DoorcrackerAirborneState } from "./states/DoorcrackerAirborneState.js";
import { DoorcrackerFireState } from "./states/DoorcrackerFireState.js";
import { DoorcrackerDeathState } from "./states/DoorcrackerDeathState.js";
import { DoorcrackerClipState } from "./states/DoorcrackerClipState.js";
import { DOORCRACKER_ANIMATION } from "./DoorcrackerAnimation.js";
import { DoorcrackerPreview } from "./DoorcrackerPreview.js";

const MODEL_URL = new URL("../../../models/enemies/doorcracker/doorcracker.glb", import.meta.url).href;
const LOOPING = new Set(["idle_loaded", "walk_loaded", "run_loaded", "carried_ready", "airborne", "fuse_loop", "stun"]);

/**
 * Royal-seeking bomber. Door sensing, fuse, reactions, and blast belong to this actor.
 */
export class Doorcracker extends Enemy {
  /**
   * @type {import("playcanvas").AnimComponent|null}
   */
  #animation = null;
  /**
   * @type {string|null}
   */
  #clip = null;
  /**
   * @type {Map<string, number>}
   */
  #durations = new Map();
  /**
   * @type {boolean}
   */
  #blastCommitted = false;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #blast = null;
  /**
   * @type {import("playcanvas").StandardMaterial|null}
   */
  #blastMaterial = null;
  /**
   * @type {number}
   */
  #encouragedUntil = 0;

  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [MODEL_URL];
  }

  /**
   * @param {import("../../ObjectTypes.js").MapObjectOptions} options
   */
  constructor(options) {
    super(options);

    this.bellImmune = true;
    this.statusImmunities = new Set(["confused"]);
    this.bracedDoor = null;
    this.stateTime = 0;
    this.reactionClip = "hit";
    this.braceDistance = 1.05;
    this.contactDistance = 0.85;
    this.fuseDuration = 2.4;
    this.fireIgnitionDuration = 0.45;
    this.detonationTime = 0.2;
    this.blastRadius = 2.8;
    this.blastDamage = 80;
    this.model = options.modelLibrary.instantiate(MODEL_URL);
    this.model.setLocalEulerAngles(0, 180, 0);
    this.entity.addChild(this.model);
    const tracks = options.modelLibrary.getAnimationTracks(MODEL_URL, Object.values(DOORCRACKER_ANIMATION));
    this.model.addComponent("anim", { activate: true });
    this.#animation = this.model.anim;
    for (const [name, track] of tracks) {
      this.#durations.set(name, track.duration);
      this.#animation.addAnimationState(name, track, 1, LOOPING.has(name));
    }
    for (const StateType of [DoorcrackerPursueState, DoorcrackerBraceState, DoorcrackerFuseState,
      DoorcrackerDetonateState, DoorcrackerReactionState, DoorcrackerCarriedState,
      DoorcrackerAirborneState, DoorcrackerFireState, DoorcrackerDeathState, DoorcrackerClipState]) {
      this.behavior.add(StateType.name, new StateType());
    }
    this.changeState(DoorcrackerPursueState.name);
    if (options.definition.testClip) {
      this.testClip = options.definition.testClip;
    }
  }

  /**
   * @returns {boolean}
   */
  get encouraged() {
    return this.elapsed < this.#encouragedUntil;
  }

  /**
   * @param {string|null} name
   */
  set testClip(name) {
    if (!this.alive || this.#blastCommitted) {
      return;
    }
    this.testAnimation = name;
    if (name && this.#durations.has(name)) {
      this.changeState(DoorcrackerClipState.name);
    } else {
      this.changeState(DoorcrackerPursueState.name);
    }
  }

  /**
   * @returns {string|null}
   */
  get activeClip() {
    return this.#clip;
  }

  async capturePreview() {
    if (!this.alive) {
      return;
    }
    this.testClip = "idle_loaded";
    try {
      await DoorcrackerPreview.capture(this.pc, this.app, this.model);
    } catch (error) {
      this.runtime.onRuntimeError?.(error);
    }
  }

  get committed() {
    return this.#blastCommitted;
  }

  /**
   * @returns {boolean}
   */
  get hasFuseTarget() {
    if (this.carrier || this.airborne) {
      return false;
    }
    if (this.bracedDoor) {
      return !!this.bracedDoor.entity && this.bracedDoor.openAmount < 0.65 &&
        this.distanceTo(this.bracedDoor) < this.braceDistance + 0.3;
    }
    const royal = this.resolveRoyalTarget();

    return !!royal && this.distanceTo(royal) < this.contactDistance + 0.3;
  }

  /**
   * @returns {string}
   */
  get testStatus() {
    return `${super.testStatus} | ${this.#clip} | fuse ${this.stateTime.toFixed(2)} | blast ${this.#blastCommitted}`;
  }

  /**
   * @param {string} name
   */
  clipDuration(name) {
    return this.#durations.get(name) ?? 0.6;
  }

  /**
   * @param {string} name
   * @param {boolean} restart
   */
  playClip(name, restart = false) {
    if (this.#clip === name && !restart) {
      return;
    }
    this.#clip = name;
    this.#animation.baseLayer.transition(name, restart ? 0 : 0.1);
  }

  /**
   * @param {string} name
   */
  changeState(name) {
    this.behavior.changeTo(name);
  }

  /**
   * Closed leaves near the royal route are obstacles; towers are never selected.
   * @param {Enemy} royal
   */
  findObstructingDoor(royal) {
    const destination = this.targetPosition(royal);
    this.entranceWaypoint = null;
    if (!destination) {
      return null;
    }
    let nearest = null;
    let distance = Infinity;
    for (const actor of this.actors) {
      const doors = (actor.entranceDoors ?? []).filter(Doorcracker.#doorHasEntity);
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
      inward.normalize();
      const offset = this.position.clone().sub(center);
      const range = destination.distance(center);
      if (offset.dot(inward) >= 0.8 || range >= distance) {
        continue;
      }
      distance = range;
      nearest = doors.find(Doorcracker.#doorClosed) ?? null;
      this.entranceWaypoint = { position: center.add(inward.mulScalar(1.1)) };
    }

    return nearest;
  }

  /**
   * @param {import("../../architecture/door/Door.js").Door} door
   */
  static #doorHasEntity(door) {
    return !!door.entity;
  }

  /**
   * @param {import("../../architecture/door/Door.js").Door} door
   */
  static #doorClosed(door) {
    return door.openAmount < 0.65;
  }

  interruptFuse() {
    if (!this.alive || this.#blastCommitted) {
      return false;
    }
    this.bracedDoor = null;
    this.reactionClip = "fuse_interrupt";
    this.changeState(DoorcrackerReactionState.name);

    return true;
  }

  /**
   * @param {{kind: string}} event
   */
  onDamaged({ kind }) {
    if (!this.alive || this.#blastCommitted) {
      return;
    }
    if (kind === "fire") {
      this.ignite();
    } else if (!this.carrier && !this.airborne && this.stateName !== DoorcrackerFireState.name) {
      this.reactionClip = this.stateName === DoorcrackerFuseState.name ||
        this.stateName === DoorcrackerBraceState.name ? "fuse_interrupt" : "hit";
      this.bracedDoor = null;
      this.changeState(DoorcrackerReactionState.name);
    }
  }

  /**
   * @param {string} name
   */
  onStatusApplied(name) {
    if (name === "fire" || name === "burning") {
      this.ignite();
    } else if (name === "stun" && this.stateName !== DoorcrackerFireState.name) {
      this.reactionClip = "stun_recover";
      this.bracedDoor = null;
      if (!this.airborne && !this.carrier) {
        this.changeState(DoorcrackerReactionState.name);
      }
    }
  }

  ignite() {
    if (this.alive && ![DoorcrackerFireState.name, DoorcrackerDetonateState.name].includes(this.stateName)) {
      this.changeState(DoorcrackerFireState.name);
    }
  }

  onBellEncouraged() {
    this.#encouragedUntil = this.elapsed + 3;
    if (this.stateName === DoorcrackerPursueState.name) {
      this.reactionClip = "volunteer_hop";
      this.changeState(DoorcrackerReactionState.name);
    }
  }

  onCarried() {
    this.bracedDoor = null;
    if (![DoorcrackerFireState.name, DoorcrackerDetonateState.name].includes(this.stateName)) {
      this.changeState(DoorcrackerCarriedState.name);
    }
  }

  onLaunched() {
    if (![DoorcrackerFireState.name, DoorcrackerDetonateState.name].includes(this.stateName)) {
      this.changeState(DoorcrackerAirborneState.name);
    }
  }

  onLanded() {
    if (this.alive && ![DoorcrackerFireState.name, DoorcrackerDetonateState.name].includes(this.stateName)) {
      this.reactionClip = "land";
      this.changeState(DoorcrackerReactionState.name);
    }
  }

  onDeath() {
    this.changeState(DoorcrackerDeathState.name);
  }

  disableContact() {
    if (this.entity.rigidbody) {
      this.entity.rigidbody.enabled = false;
    }
    if (this.entity.collision) {
      this.entity.collision.enabled = false;
    }
    this.carrier = null;
    this.airborne = false;
  }

  /**
   * Damage is radial on BOTH sides of the doorway, including friendly enemies.
   */
  commitBlast() {
    if (this.#blastCommitted || !this.alive) {
      return false;
    }
    this.#blastCommitted = true;
    this.health = 0;
    this.statuses.clear();
    this.disableContact();
    this.model.enabled = false;
    // Publish terminal state before callbacks, so chained blasts cannot re-enter us.
    for (const actor of this.actors) {
      if (actor === this || actor.alive === false || this.distanceTo(actor) > this.blastRadius) {
        continue;
      }
      if (typeof actor.receiveDamage === "function") {
        actor.receiveDamage(this.blastDamage, this, "explosion");
      } else if (typeof actor.beginGameOver === "function") {
        actor.beginGameOver(() => this.position.clone());
      }
    }
    this.bracedDoor?.receiveDamage?.(this.blastDamage, this, "explosion");
    this.#createBlastEffect();

    return true;
  }

  #createBlastEffect() {
    const pc = this.pc;
    this.#blastMaterial = new pc.StandardMaterial();
    this.#blastMaterial.diffuse.set(1, 0.35, 0.01);
    this.#blastMaterial.emissive.set(1, 0.2, 0.005);
    this.#blastMaterial.blendType = pc.BLEND_ADDITIVE;
    this.#blastMaterial.depthWrite = false;
    this.#blastMaterial.opacity = 0.65;
    this.#blastMaterial.update();
    this.#blast = new pc.Entity("Doorcracker blast");
    this.#blast.addComponent("render", { type: "sphere" });
    this.#blast.render.meshInstances[0].material = this.#blastMaterial;
    this.#blast.setLocalPosition(0, this.height / 2, 0);
    this.entity.addChild(this.#blast);
  }

  #checkFireContact() {
    if (!this.alive || [DoorcrackerFireState.name, DoorcrackerDetonateState.name].includes(this.stateName)) {
      return;
    }
    for (const actor of this.actors) {
      const volume = actor.definition?.volume;
      const emitter = actor.entity?.findByName?.("Rising fire particles");
      if (!volume || !emitter?.enabled || !emitter.parent?.enabled) {
        continue;
      }
      const local = emitter.parent.getWorldTransform().clone().invert().transformPoint(this.position);
      if (Math.abs(local.x) <= volume.x / 2 + this.radius &&
        Math.abs(local.z) <= volume.z / 2 + this.radius &&
        local.y <= volume.y && local.y + this.height >= 0) {
        this.ignite();

        return;
      }
    }
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    super.update(dt);

    if (Number.isFinite(dt) && dt > 0) {
      this.#checkFireContact();
    }

    if (this.#blast) {
      const phase = Math.min(1, Math.max(0, (this.stateTime - this.detonationTime) / 0.4));
      this.#blast.setLocalScale(0.2 + phase * this.blastRadius * 2,
        0.2 + phase * this.blastRadius * 2, 0.2 + phase * this.blastRadius * 2);
      this.#blastMaterial.opacity = 0.65 * (1 - phase);
      this.#blastMaterial.update();
    }
  }

  destroy() {
    this.#blast?.destroy();
    this.#blast = null;
    this.#blastMaterial?.destroy();
    this.#blastMaterial = null;
    super.destroy();
  }
}
