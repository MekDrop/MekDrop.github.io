import { Enemy } from "../shared/Enemy.js";
import { GobblerPursueState } from "./states/GobblerPursueState.js";
import { GobblerBiteState } from "./states/GobblerBiteState.js";
import { GobblerDigestState } from "./states/GobblerDigestState.js";
import { GobblerCarriedState } from "./states/GobblerCarriedState.js";
import { GobblerAirborneState } from "./states/GobblerAirborneState.js";
import { GobblerAngryState } from "./states/GobblerAngryState.js";
import { GobblerStunnedState } from "./states/GobblerStunnedState.js";
import { GobblerDeadState } from "./states/GobblerDeadState.js";
import { GobblerNavigation } from "./GobblerNavigation.js";
import { GobblerPlayback } from "./GobblerPlayback.js";
import { GobblerPreview } from "./GobblerPreview.js";
import { GobblerInspectState } from "./states/GobblerInspectState.js";
import { SNACK_GOBBLER_ANIMATION } from "../../../enum/SnackGobblerAnimation.js";
import { gobblerClips } from "./GobblerClips.js";
import { GobblerPlaybackAudit } from "./GobblerPlaybackAudit.js";
import { GobblerHitState } from "./states/GobblerHitState.js";
import { GobblerBehaviorAudit } from "./GobblerBehaviorAudit.js";

/**
 * Royal-directed hungry creature with a Tripo shell and authored creature rig.
 */
export class SnackGobbler extends Enemy {
  /**
   * @type {string}
   */
  static modelUrl = new URL("../../../models/enemies/snack-gobbler/snack-gobbler.glb", import.meta.url).href;
  /**
   * @type {string[]}
   */
  static modelUrls = [SnackGobbler.modelUrl];
  /**
   * @param {import("../../ObjectTypes.js").MapObjectOptions} options
   */
  constructor(options) {
    super(options);

    this.bellImmune = true;
    this.radius = 0.48;
    this.height = 0.97;
    this.hungryAt = 0;
    this.sleepyUntil = 0;
    this.angryUntil = 0;
    this.biteTarget = null;
    this.requestedClip = SNACK_GOBBLER_ANIMATION.IDLE;
    this.navigation = new GobblerNavigation(this);
    this.playbackAudit = new GobblerPlaybackAudit(this);
    this.behaviorAudit = new GobblerBehaviorAudit(this);
    if (this.modelLibrary) {
      this.model = this.modelLibrary.instantiate(SnackGobbler.modelUrl);
      this.model.setLocalPosition(0, 0.005, 0.1333);
      this.model.setLocalEulerAngles(0, 180, 0);
      this.entity.addChild(this.model);
      this.playback = new GobblerPlayback(this.model, this.modelLibrary, SnackGobbler.modelUrl);
    }
    const states = [
      new GobblerPursueState(),
      new GobblerBiteState(),
      new GobblerDigestState(),
      new GobblerCarriedState(),
      new GobblerAirborneState(),
      new GobblerAngryState(),
      new GobblerStunnedState(),
      new GobblerDeadState(),
      new GobblerInspectState(),
      new GobblerHitState(),
    ];
    for (const state of states) {
      this.behavior.add(state.constructor.name, state);
    }
    this.behavior.changeTo(options.definition.testInspection ? GobblerInspectState.name : GobblerPursueState.name);
  }

  /**
   * @returns {string}
   */
  get testStatus() {
    return `${super.testStatus}\n${this.requestedClip}; hungry: ${this.hungry}; sleepy: ${this.sleepy}`;
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    super.update(dt);
    this.playbackAudit.update(dt);
  }

  /**
   * @param {number} direction
   */
  testStepClip(direction) {
    const index = gobblerClips.findIndex(this.#isRequestedClip.bind(this));
    this.testPlayClip(gobblerClips[(index + direction + gobblerClips.length) % gobblerClips.length].name);
  }

  /**
   * @param {{name:string}} clip
   * @returns {boolean}
   */
  #isRequestedClip(clip) {
    return clip.name === this.requestedClip;
  }

  /**
   * @param {string|null} name
   */
  testPlayClip(name) {
    this.behavior.changeTo(name ? GobblerInspectState.name : GobblerPursueState.name);
    if (name) {
      this.requestedClip = name;
      this.playback?.play(name, true);
    }
  }

  /**
   * @returns {Promise<{visiblePixels:number,transparentPixels:number,margin:number}>}
   */
  testCapturePreview() {
    return new GobblerPreview(this).capture();
  }

  /**
   * @returns {boolean}
   */
  get hungry() {
    return this.elapsed >= this.hungryAt;
  }

  /**
   * @returns {boolean}
   */
  get sleepy() {
    return this.elapsed < this.sleepyUntil;
  }

  /**
   * @returns {number}
   */
  get movementSpeed() {
    return this.sleepy ? 0.109 : 0.233;
  }

  /**
   * Explicit opt-out and measured dimensions keep large allies out of its diet.
   * @param {Enemy} actor
   * @returns {boolean}
   */
  canEat(actor) {
    const small = actor?.edibleByGobbler === true ||
      (Number.isFinite(actor?.radius) && actor.radius <= 0.35 &&
        Number.isFinite(actor?.height) && actor.height <= 1.2);

    return this.alive && this.hungry && actor !== this && actor?.alive === true &&
      actor.isEnemy === true && actor.edibleByGobbler !== false && small &&
      !actor.carrier && !actor.airborne && !actor.isRoyal &&
      typeof actor.receiveDamage === "function";
  }

  /**
   * @returns {Enemy|null}
   */
  findFood() {
    let nearest = null;
    let distance = 2.5;
    for (const actor of this.actors) {
      if (!this.canEat(actor)) {
        continue;
      }
      const candidateDistance = this.distanceTo(actor);
      if (candidateDistance < distance) {
        nearest = actor;
        distance = candidateDistance;
      }
    }

    return nearest;
  }

  /**
   * Commit only at the authored bite contact, rechecking range and eligibility.
   * @param {Enemy} actor
   * @returns {boolean}
   */
  consume(actor) {
    if (!this.canEat(actor) || this.distanceTo(actor) > 0.85 || !this.navigation.canReach(actor)) {
      return false;
    }
    const applied = actor.receiveDamage(actor.health, this, "consumed");
    if (!(applied > 0) || actor.alive) {
      return false;
    }
    // Consumed corpses leave both rendering and collision immediately. Their
    // owning death state still releases its subscriptions and resources.
    actor.entity.enabled = false;
    this.receiveHealing(35);
    this.hungryAt = this.elapsed + 18;
    this.sleepyUntil = this.elapsed + 10;
    for (const observer of this.actors) {
      // Pitchers own the queue and decide whether this victim was waiting.
      observer.onAllyConsumed?.({
        victim: actor,
        consumer: this,
      });
    }

    return true;
  }

  /**
   * @param {string} clip
   */
  requestClip(clip) {
    this.requestedClip = clip;
    this.playback?.play(clip);
  }

  /**
   * @param {Enemy} actor
   */
  bite(actor) {
    if (!this.alive || !actor || actor.alive === false || this.distanceTo(actor) > 0.85 || !this.navigation.canReach(actor)) {
      return;
    }
    if (typeof actor.receiveDamage === "function") {
      actor.receiveDamage(16, this, "bite");
    } else {
      actor.beginGameOver?.();
    }
  }

  onCarried() {
    this.behavior.changeTo(GobblerCarriedState.name);
  }

  onLaunched() {
    this.behavior.changeTo(GobblerAirborneState.name);
  }

  onLanded() {
    this.angryUntil = this.elapsed + 6;
    this.behavior.changeTo(this.statuses.has("stun") ? GobblerStunnedState.name : GobblerAngryState.name);
  }

  /**
   * @param {string} name
   */
  onStatusApplied(name) {
    if (name === "stun" && !this.carrier && !this.airborne) {
      this.behavior.changeTo(GobblerStunnedState.name);
    }
  }

  onDeath() {
    this.behavior.changeTo(GobblerDeadState.name);
  }

  onDamaged() {
    if (this.alive && !this.carrier && !this.airborne && !this.statuses.has("stun")) {
      this.behavior.changeTo(GobblerHitState.name);
    }
  }
}
