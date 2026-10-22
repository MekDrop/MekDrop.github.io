import { Enemy } from "../shared/Enemy.js";
import { BrutePursueState } from "./states/BrutePursueState.js";
import { BruteWindupState } from "./states/BruteWindupState.js";
import { BruteSwingState } from "./states/BruteSwingState.js";
import { BruteRecoverState } from "./states/BruteRecoverState.js";
import { BruteDoorBashState } from "./states/BruteDoorBashState.js";
import { BruteAngerState } from "./states/BruteAngerState.js";
import { BruteStunState } from "./states/BruteStunState.js";
import { BruteStunRecoverState } from "./states/BruteStunRecoverState.js";
import { BruteHitState } from "./states/BruteHitState.js";
import { BruteDeathState } from "./states/BruteDeathState.js";
import { BruteClipTestState } from "./states/BruteClipTestState.js";
import { BruteKnockbackState } from "./states/BruteKnockbackState.js";
import { MUSHROOM_BRUTE_ANIMATION } from "./MushroomBruteAnimation.js";
import { MushroomBrutePreview } from "./MushroomBrutePreview.js";
import { MushroomBrutePlaybackCheck } from "./MushroomBrutePlaybackCheck.js";
import { MushroomBruteCastleCheck } from "./MushroomBruteCastleCheck.js";

// The leaf entry supplies Vite's asset URL; the file URL also supports unit tests.
const MODEL_URL = new URL("../../../models/enemies/mushroom-brute/mushroom-brute.glb", import.meta.url).href;
const LOOPING_CLIPS = new Set(["idle", "heavy_walk", "run", "stun"]);
const REQUIRED_CLIPS = Object.values(MUSHROOM_BRUTE_ANIMATION);

/**
 * Heavy royal attacker. The artwork is a required asset, with no primitive fallback.
 */
export class MushroomBrute extends Enemy {
  /**
   * @type {string}
   */
  static modelUrl = MODEL_URL;
  /**
   * @type {import("playcanvas").AnimComponent}
   */
  #animation;
  /**
   * @type {string|null}
   */
  #clip = null;
  /**
   * @type {number[]}
   */
  #bellTimes = [];
  /**
   * @type {number}
   */
  #angerUntil = 0;
  /**
   * @type {import("../shared/Enemy.js").EnemyActor|null}
   */
  #angerSource = null;
  /**
   * @type {WeakSet<import("../shared/Enemy.js").EnemyActor>}
   */
  #royalReached = new WeakSet();

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

    this.radius = 0.48;
    this.height = 1.6;
    this.clubRange = 1.65;
    this.maxHealth = Number.isFinite(options.definition.maxHealth) ? Math.max(1, options.definition.maxHealth) : 260;
    this.health = this.maxHealth;
    this.bellImmune = true;
    this.stateElapsed = 0;
    this.attackYaw = 0;
    this.attackTarget = null;
    this.attackDoor = null;
    this.angerClip = "snort";
    this.swingRecipients = new Set();
    const modelUrl = this.constructor.modelUrl;
    const model = this.modelLibrary.instantiate(modelUrl);
    this.modelRoot = model;
    model.setLocalEulerAngles(0, 180, 0);
    this.entity.addChild(model);
    model.addComponent("anim", { activate: true });
    this.#animation = model.anim;
    const tracks = this.modelLibrary.getAnimationTracks(modelUrl, REQUIRED_CLIPS);
    for (const name of REQUIRED_CLIPS) {
      this.#animation.addAnimationState(name, tracks.get(name), 1, LOOPING_CLIPS.has(name));
    }
    this.#animation.baseLayer.play("idle");
    this.#clip = "idle";
    for (const StateType of [
      BrutePursueState, BruteWindupState, BruteSwingState, BruteRecoverState,
      BruteDoorBashState, BruteAngerState, BruteStunState, BruteStunRecoverState,
      BruteHitState, BruteDeathState, BruteClipTestState, BruteKnockbackState,
    ]) {
      this.behavior.add(StateType.name, new StateType());
    }
    this.behavior.changeTo(BrutePursueState.name);
  }

  /**
   * @returns {boolean}
   */
  get enraged() {
    return this.elapsed < this.#angerUntil;
  }

  /**
   * @returns {import("../shared/Enemy.js").EnemyActor|null}
   */
  get pursuitTarget() {
    if (this.enraged && this.#angerSource?.alive !== false && this.targetPosition(this.#angerSource)) {
      return this.#angerSource;
    }
    return this.resolveRoyalTarget();
  }

  /**
   * @returns {string}
   */
  get testStatus() {
    return `${super.testStatus} | ${this.enraged ? "angry" : "royal pursuit"} | ${this.#clip}`;
  }

  /**
   * @returns {import("playcanvas").AnimComponent}
   */
  get animationComponent() {
    return this.#animation;
  }

  /**
   * @returns {string|null}
   */
  get activeClip() {
    return this.#clip;
  }

  onSceneReady() {
    super.onSceneReady();
    this.entity.rigidbody.mass = 85;
  }

  /**
   * @param {string} name
   * @returns {boolean}
   */
  testPlayClip(name) {
    if (!this.alive || !REQUIRED_CLIPS.includes(name)) {
      return false;
    }
    this.testClip = name;
    this.behavior.changeTo(BruteClipTestState.name);

    return true;
  }

  resumeBehavior() {
    if (this.alive) {
      this.behavior.changeTo(this.statuses.has("stun") ? BruteStunState.name : BrutePursueState.name);
    }
  }

  /**
   * @returns {Promise<{visible:number,transparent:number}>}
   */
  capturePreview() {
    return MushroomBrutePreview.capture(this);
  }

  /**
   * @returns {Promise<{passed:boolean,clips:Array<{name:string,passed:boolean}>}>}
   */
  runPlaybackCheck() {
    return MushroomBrutePlaybackCheck.run(this);
  }

  /**
   * @returns {Promise<object>}
   */
  runCastleCheck() {
    return MushroomBruteCastleCheck.run(this);
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} target
   * @returns {boolean}
   */
  hasReachedRoyal(target) {
    return this.#royalReached.has(target);
  }

  /**
   * @param {string} name
   * @param {boolean} restart
   */
  playClip(name, restart = false) {
    if (restart || name !== this.#clip) {
      this.#animation.baseLayer.transition(name, restart ? 0 : 0.12);
      this.#clip = name;
    }
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor|null} target
   */
  faceTarget(target) {
    const point = this.targetPosition(target);
    if (!point) {
      return;
    }
    this.attackYaw = Math.atan2(point.x - this.position.x, point.z - this.position.z);
    this.entity.setEulerAngles(0, this.attackYaw * 180 / Math.PI + 180, 0);
  }

  /**
   * Query production door leaf triangles, without reaching into castle internals.
   * @param {import("../shared/Enemy.js").EnemyActor} target
   * @returns {{door: import("../../architecture/door/Door.js").Door, distance: number}|null}
   */
  findBlockingDoor(target) {
    const point = this.targetPosition(target);
    if (!point) {
      return null;
    }
    const start = this.position.clone().add(new this.pc.Vec3(0, 0.7, 0));
    const end = new this.pc.Vec3(point.x, start.y, point.z);
    let closest = null;
    for (const actor of this.actors) {
      if (actor === this || !actor.getPointerHit) {
        continue;
      }
      const hit = actor.getPointerHit(start, end);
      if (hit?.door && hit.door.openAmount < 0.85 && (!closest || hit.distance < closest.distance)) {
        closest = hit;
      }
    }

    return closest;
  }

  /**
   * Ray queries use Ammo's real colliders. Exclude only this brute's body.
   * @param {import("playcanvas").Vec3} start
   * @param {import("playcanvas").Vec3} end
   * @returns {import("playcanvas").RaycastResult|null}
   */
  firstContact(start, end) {
    const hits = this.app.systems.rigidbody?.raycastAll(start, end) ?? [];
    hits.sort(MushroomBrute.#nearestHit);
    for (const hit of hits) {
      if (!this.ownsEntity(hit.entity)) {
        return hit;
      }
    }

    return null;
  }

  /**
   * @param {import("playcanvas").RaycastResult} a
   * @param {import("playcanvas").RaycastResult} b
   */
  static #nearestHit(a, b) {
    return a.hitFraction - b.hitFraction;
  }

  /**
   * @param {import("playcanvas").Entity} entity @returns {boolean}
   */
  ownsEntity(entity) {
    for (let node = entity; node; node = node.parent) {
      if (node === this.entity) {
        return true;
      }
    }

    return false;
  }

  /**
   * @param {import("playcanvas").Entity} entity @returns {import("../shared/Enemy.js").EnemyActor|null}
   */
  actorForEntity(entity) {
    for (let node = entity; node; node = node.parent) {
      if (node.enemy) {
        return node.enemy;
      }
      for (const actor of this.actors) {
        if (actor.entity === node || actor.audienceActor?.entity === node) {
          return actor;
        }
      }
    }

    return null;
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} actor @returns {boolean}
   */
  hasClearContact(actor) {
    const point = this.targetPosition(actor);
    if (!point || Math.abs(point.y - this.position.y) > 0.9 || this.findBlockingDoor(actor)) {
      return false;
    }
    const start = this.position.clone().add(new this.pc.Vec3(0, 0.7, 0));
    const end = new this.pc.Vec3(point.x, start.y, point.z);
    const hit = this.firstContact(start, end);

    return !hit || this.actorForEntity(hit.entity) === actor;
  }

  /**
   * Sample the authored club's horizontal contact arc with actual physics rays.
   * At 1.65m, four-degree gaps are narrower than enemy contact capsules.
   * @param {number} from Seconds in club_swing.
   * @param {number} to Seconds in club_swing.
   */
  sweepClub(from, to) {
    const start = this.position.clone().add(new this.pc.Vec3(0, 0.7, 0));
    // The left-hand club crosses from the brute's right to its left in the clip.
    const first = 80 - (from - 0.12) / 0.24 * 160;
    const last = 80 - (to - 0.12) / 0.24 * 160;
    const samples = Math.max(1, Math.ceil(Math.abs(last - first) / 4));
    for (let sample = 0; sample <= samples; sample++) {
      const angle = this.attackYaw + (first + (last - first) * sample / samples) * Math.PI / 180;
      const end = new this.pc.Vec3(
        start.x + Math.sin(angle) * this.clubRange,
        start.y,
        start.z + Math.cos(angle) * this.clubRange,
      );
      const hit = this.firstContact(start, end);
      const actor = hit ? this.actorForEntity(hit.entity) : null;
      if (actor?.isEnemy && actor !== this && actor.alive !== false && !this.swingRecipients.has(actor)) {
        this.swingRecipients.add(actor);
        actor.receiveDamage?.(this.enraged ? 48 : 32, this, "club");
        actor.entity?.rigidbody?.applyImpulse(Math.sin(angle) * 7, 1, Math.cos(angle) * 7);
      }
    }
    // Production royals have no dynamic body. Use their real actor location and
    // Ammo occlusion rather than inventing a duplicate royal collision proxy.
    const royal = this.resolveRoyalTarget();
    if (!royal || this.#royalReached.has(royal) || this.swingRecipients.has(royal) || this.distanceTo(royal) > this.clubRange || !this.hasClearContact(royal)) {
      return;
    }
    const point = this.targetPosition(royal);
    const angle = Math.atan2(point.x - start.x, point.z - start.z) - this.attackYaw;
    const degrees = Math.atan2(Math.sin(angle), Math.cos(angle)) * 180 / Math.PI;
    if (degrees < Math.min(first, last) - 4 || degrees > Math.max(first, last) + 4) {
      return;
    }
    this.swingRecipients.add(royal);
    if (royal.receiveDamage) {
      royal.receiveDamage(32, this, "club");
    } else {
      const performance = royal.beginGameOver?.(() => this.position.clone());
      if (performance) {
        this.#royalReached.add(royal);
        royal.startGameOverPerformance?.();
      }
    }
  }

  bashDoor() {
    const target = this.pursuitTarget;
    const hit = target ? this.findBlockingDoor(target) : null;
    if (hit?.door !== this.attackDoor || hit.distance > this.clubRange) {
      return;
    }
    const start = this.position.clone().add(new this.pc.Vec3(0, 0.7, 0));
    const point = this.targetPosition(target);
    const end = new this.pc.Vec3(point.x, start.y, point.z).sub(start).normalize()
      .mulScalar(hit.distance).add(start);
    const obstruction = this.firstContact(start, end);
    if (obstruction && !MushroomBrute.#belongsTo(obstruction.entity, hit.door.entity)) {
      return;
    }
    // Production doors own leaf health, breakage and collider removal.
    hit.door.receiveDamage(16);
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @param {import("playcanvas").Entity} root
   * @returns {boolean}
   */
  static #belongsTo(entity, root) {
    for (let node = entity; node; node = node.parent) {
      if (node === root) {
        return true;
      }
    }

    return false;
  }

  /**
   * Base deduplicates primary events and rejects secondary feedback rings.
   * @param {import("../shared/Enemy.js").EnemyActor|null} source
   */
  onBellEncouraged(source) {
    this.#bellTimes = this.#bellTimes.filter(this.#recentBell);
    this.#bellTimes.push(this.elapsed);
    if (this.#bellTimes.length >= 3) {
      this.irritate(source, "stomp");
      this.#bellTimes = [];
    }
  }

  /**
   * @type {(time: number) => boolean}
   */
  #recentBell = (time) => time >= this.elapsed - 6;

  /**
   * @param {import("../shared/Enemy.js").EnemyActor|null} source
   * @param {string} clip
   */
  irritate(source, clip) {
    if (!this.alive) {
      return;
    }
    this.#angerSource = source;
    this.#angerUntil = this.elapsed + 7;
    this.angerClip = clip;
    if (!this.statuses.has("stun") && this.stateName !== BruteStunRecoverState.name) {
      this.behavior.changeTo(BruteAngerState.name);
    }
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor|null} carrier @returns {boolean}
   */
  canBeCarriedBy(carrier) {
    return false;
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor|null} carrier @returns {boolean}
   */
  beginCarry(carrier) {
    this.irritate(carrier, "reject_pickup");

    return false;
  }

  /**
   * @returns {boolean}
   */
  launch() {
    return false;
  }

  /**
   * @param {string} name
   */
  onStatusApplied(name) {
    if (name === "stun") {
      this.behavior.changeTo(BruteStunState.name);
    }
  }

  /**
   * @param {{kind?: string}} details
   */
  onDamaged({ kind } = {}) {
    if (this.alive && !this.statuses.has("stun")) {
      this.behavior.changeTo(kind === "knockback" ? BruteKnockbackState.name : BruteHitState.name);
    }
  }

  onDeath() {
    this.behavior.changeTo(BruteDeathState.name);
  }
}
