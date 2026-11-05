import { LatchAffection } from "./LatchAffection.js";
import { LatchPatPresentation } from "./LatchPatPresentation.js";
import { LatchPatInteraction } from "./LatchPatInteraction.js";
import { LATCH_SLUG_ANIMATION as ANIMATION } from "./LatchSlugAnimation.js";
import { Enemy } from "../shared/Enemy.js";
import { LatchGlue } from "./LatchGlue.js";
import { LatchSeekState } from "./states/LatchSeekState.js";
import { LatchDogState } from "./states/LatchDogState.js";
import { LatchPressState } from "./states/LatchPressState.js";
import { LatchReactionState } from "./states/LatchReactionState.js";
import { LatchDeadState } from "./states/LatchDeadState.js";
import { LatchClipState } from "./states/LatchClipState.js";
import { LatchSlugPreview } from "./LatchSlugPreview.js";
import { LatchSlugPlaybackCheck } from "./LatchSlugPlaybackCheck.js";
import { LatchSlugNavigation } from "./LatchSlugNavigation.js";
import { LatchDoorLeap } from "./LatchDoorLeap.js";
import { LatchLeapState } from "./states/LatchLeapState.js";
import { LatchSplash } from "./LatchSplash.js";
import { LatchSlugAudio } from "../../../audio/latch-slug/LatchSlugAudio.js";
import { GameObjectAudio } from "../../../audio/GameObjectAudio.js";
import { LatchSlimeTrail } from "./LatchSlimeTrail.js";
import { LatchJellyMaterial } from "./LatchJellyMaterial.js";
import { LatchPack } from "./LatchPack.js";
import { LatchHeroGaze } from "./LatchHeroGaze.js";
import { LatchGroundCrawl } from "./LatchGroundCrawl.js";
import { LatchStairSurface } from "./LatchStairSurface.js";
import { LatchHurry } from "./LatchHurry.js";
import { LatchIdleHop } from "./LatchIdleHop.js";
import { LatchIdleHopState } from "./states/LatchIdleHopState.js";
const LOOPING_CLIPS = new Set([
  ANIMATION.IDLE_DOG, ANIMATION.WADDLE_WALK, ANIMATION.WADDLE_RUN, ANIMATION.PANT,
  ANIMATION.SIT_LOOP, ANIMATION.FOLLOW, ANIMATION.ANTENNA_WAG, ANIMATION.STUN,
  ANIMATION.CARRIED_READY, ANIMATION.AIRBORNE, ANIMATION.INFLATE_LOOP,
]);

/**
 * Map-owned nuisance behavior with the authored slug mesh and embedded clips.
 */
export class LatchSlug extends Enemy {
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #model = null;
  /**
   * @type {LatchGroundCrawl|null}
   */
  #groundCrawl = null;
  /**
   * @type {LatchStairSurface|null}
   */
  #stairSurface = null;
  /**
   * @type {LatchSlugPlaybackCheck|null}
   */
  #playbackCheck = null;
  /**
   * @type {LatchSlugNavigation}
   */
  #navigation;
  /**
   * @type {LatchDoorLeap}
   */
  #doorLeap;
  /**
   * @type {import("playcanvas").EventHandle|null}
   */
  #doorContact = null;
  /**
   * @type {LatchSlimeTrail|null}
   */
  #trail = null;
  /**
   * @type {LatchJellyMaterial|null}
   */
  #jelly = null;
  /**
   * @type {LatchHeroGaze|null}
   */
  gaze = null;
  /**
   * @type {LatchPack}
   */
  pack;
  /**
   * @type {LatchAffection}
   */
  affection;
  /**
   * @type {LatchPatPresentation|null}
   */
  patPresentation = null;
  /**
   * @type {LatchHurry}
   */
  hurry;
  /**
   * @type {LatchIdleHop}
   */
  idleHop;
  /**
   * Continuous pulse clock, advanced faster during the stamina burst.
   * @type {number}
   */
  crawlTime = 0;

  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [new URL("../../../models/enemies/latch-slug/latch-slug.glb", import.meta.url).href, LatchSplash.modelUrl, LatchPatPresentation.modelUrl];
  }
  /**
   * @returns {string[]}
   */
  static get audioUrls() {
    return [LatchSlugAudio.jump.wavUrl, LatchSlugAudio.splash.wavUrl, LatchSlugAudio.idleHop.wavUrl];
  }
  /**
   * @type {GameObjectAudio|null}
   */
  audio = null;
  /**
   * @type {LatchSplash|null}
   */
  splash = null;
  /**
   * @type {number}
   */
  stateAge = 0;
  /**
   * @type {import("../../architecture/door/Door.js").Door|null}
   */
  doorTarget = null;
  /**
   * @type {LatchGlue|null}
   */
  residue = null;
  /**
   * @type {string}
   */
  requestedClip = ANIMATION.IDLE_DOG;

  /**
   * @param {import("../../ObjectTypes.js").MapObjectOptions} options
   */
  constructor(options) {
    super(options);

    this.pack = new LatchPack(this);
    this.affection = new LatchAffection(this);
    this.hurry = new LatchHurry(this);
    this.idleHop = new LatchIdleHop(this);
    this.radius = 0.42;
    // Ammo clamps a capsule shorter than its diameter to a sphere. Matching the
    // diameter keeps its bottom at the model's grounded semantic root.
    this.height = this.radius * 2;
    this.#navigation = new LatchSlugNavigation(this);
    this.#doorLeap = new LatchDoorLeap(this);
    const position = options.definition.position;
    if (position) {
      this.entity.setPosition(position.x, position.y ?? 0, position.z);
    }
    for (const StateClass of [LatchSeekState, LatchDogState, LatchPressState, LatchLeapState, LatchIdleHopState, LatchReactionState, LatchDeadState, LatchClipState]) {
      this.behavior.add(StateClass.name, new StateClass());
    }
    this.behavior.changeTo(LatchSeekState.name);
  }

  /**
   * @param {import("../../architecture/door/Door.js").Door} door
   * @returns {boolean}
   */
  approachDoor(door) {
    return this.#navigation.approachDoor(door);
  }

  /**
   * @returns {LatchGroundCrawl|null}
   */
  get stairCrawl() {
    return this.#groundCrawl;
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} target
   * @param {number} speed
   * @param {number} arrivalRadius
   * @returns {boolean}
   */
  moveToward(target, speed = 1.2, arrivalRadius = 0.05) {
    speed *= this.hurry.speedFactor;
    const limit = this.stairCrawl?.active ? this.stairCrawl.speedLimit : this.#navigation?.crawling ? 0.65 : speed;

    if (limit === 0) {
      // A paused reach must not derive its heading from a zero velocity vector.
      this.stop();

      return true;
    }

    // The foot wave carries a mostly steady body, with a gentle gather phase.
    const pulse = this.stairCrawl?.active ? 1 : 1 - 0.15 * Math.cos(this.crawlTime * Math.PI * 2 / 1.6);

    return super.moveToward(target, Math.min(speed, limit) * pulse, arrivalRadius);
  }

  /**
   * @returns {boolean}
   */
  advanceToPack() {
    return this.#navigation.advanceRoute();
  }

  /**
   * @returns {import("../shared/Enemy.js").EnemyActor|null}
   */
  resolvePackTarget() {
    return this.pack.resolve();
  }

  onSceneReady() {
    const url = LatchSlug.modelUrls[0];
    this.#model = this.modelLibrary.instantiate(url);
    this.entity.addChild(this.#model);
    this.#model.addComponent("anim", { activate: true });
    const tracks = this.modelLibrary.getAnimationTracks(url, Object.values(ANIMATION));
    for (const [name, track] of tracks) {
      this.#model.anim.addAnimationState(name, track, 1, LOOPING_CLIPS.has(name));
    }
    this.#model.anim.baseLayer.play(this.requestedClip);
    this.#jelly = new LatchJellyMaterial(this, this.#model);
    this.gaze = new LatchHeroGaze(this, this.#model);
    this.#groundCrawl = new LatchGroundCrawl(this, this.#model);
    this.#stairSurface = new LatchStairSurface(this, this.#model);
    this.splash = new LatchSplash(this);
    if (this.runtime.audioLibrary) {
      this.audio = new GameObjectAudio(this.entity, this.app, this.runtime.audioLibrary,
        {
          jump: LatchSlugAudio.jump,
          splash: LatchSlugAudio.splash,
          idleHop: LatchSlugAudio.idleHop,
        }, 0.6);
      this.audio.follow(() => this.runtime.getHero()?.position ?? null, 14);
    }
    super.onSceneReady();
    this.#trail = new LatchSlimeTrail(this);
    this.patPresentation = new LatchPatPresentation(this);
    this.#doorContact = this.entity.rigidbody.on("contact", this.onDoorContact, this);
    if (this.definition.testClip && !this.gatewayArrival.active) {
      this.testPlayClip(this.definition.testClip);
    }
  }

  /**
   * @returns {string}
   */
  get testStatus() {
    const layer = this.#model?.anim?.baseLayer;

    return this.#playbackCheck?.status || `${super.testStatus}\n${this.requestedClip} ${(layer?.activeStateCurrentTime ?? 0).toFixed(2)}s\nAffection ${this.affection.charge.toFixed(1)}/3s`;
  }

  verifyPlayback() {
    if (!this.#model || !this.alive) {
      return;
    }
    this.#playbackCheck?.destroy();
    this.#playbackCheck = new LatchSlugPlaybackCheck(this, this.#model);
    this.#playbackCheck.start();
  }

  /**
   * @param {string} clip
   */
  testPlayClip(clip) {
    const exists = Object.values(ANIMATION).includes(clip);
    if (!exists || !this.alive) {
      return false;
    }
    this.#doorLeap.cancel();
    this.behavior.changeTo(LatchClipState.name);
    this.playClip(clip);
    this.#model?.anim?.baseLayer.transition(clip, 0);

    return true;
  }

  resumeBehavior() {
    if (this.alive) {
      this.behavior.changeTo(LatchSeekState.name);
    }
  }

  /**
   * @returns {Promise<{visiblePixels:number,transparentPixels:number,margin:number}|null>}
   */
  capturePreview() {
    this.testPlayClip(ANIMATION.IDLE_DOG);

    return new LatchSlugPreview(this).capture();
  }

  /**
   * @returns {import("../../architecture/door/Door.js").Door|null}
   */
  get nearbyDoor() {
    let nearest = null;
    let distance = 1.25;
    let closed = null;
    let closedDistance = 4.5;
    for (const actor of this.actors) {
      for (const door of actor.destructibleDoors ?? actor.entranceDoors ?? []) {
        const candidate = this.distanceTo(door);
        if (!door.broken && door.openAmount > 0.001 && candidate < distance) {
          distance = candidate;
          nearest = door;
        }
        if (!door.broken && door.openAmount <= 0.001 && candidate < closedDistance && this.#doorLeap.sees(door)) {
          closedDistance = candidate;
          closed = door;
        }
      }
    }

    return closed ?? nearest;
  }

  /**
   * @param {string} clip
   */
  playClip(clip) {
    if (this.requestedClip !== clip) {
      this.#model?.anim?.baseLayer.transition(clip, 0.12);
    }
    this.requestedClip = clip;
  }

  /**
   * Follow castle entrances, walkable floors and prop clearance using Ammo steering.
   * @param {import("../shared/Enemy.js").EnemyActor} target
   * @param {number} speed
   * @returns {boolean}
   */
  followTarget(target, speed) {
    const next = this.#navigation.next(target);

    return this.moveToward(next ?? target, speed, 0.025);
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} target
   */
  faceTarget(target) {
    const point = this.targetPosition(target);
    if (point) {
      const heading = new this.pc.Vec3(0, Math.atan2(this.position.x - point.x, this.position.z - point.z) * 180 / Math.PI, 0);
      const body = this.entity.rigidbody;
      // Set Ammo's orientation too: a dynamic body's next physics step otherwise
      // restores its old heading and makes a committed leap travel backwards.
      if (body?.teleport) {
        body.teleport(this.position, heading);
      } else {
        this.entity.setEulerAngles(heading);
      }
    }
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) {
      return;
    }
    this.hurry.update(dt);
    this.crawlTime += dt * this.hurry.speedFactor;
    if (this.gatewayArrival.active) {
      super.update(dt);

      return;
    }
    this.stateAge += dt;
    if (!this.alive) {
      this.residue?.update(dt);
      if (this.residue?.active) {
        this.limitNearbyMovement(0.45);
      } else if (this.stateAge > 1.2) {
        this.destroy();
      }
      return;
    }
    super.update(dt);
    this.idleHop.update(dt);
    this.#updateAnimationSpeed();
    this.affection.update(dt);
    if (this.alive && !this.carrier && !this.airborne) {
      this.limitNearbyMovement(0.65);
    }
  }

  #updateAnimationSpeed() {
    if (!this.#model?.anim) {
      return;
    }
    if (this.requestedClip === ANIMATION.IDLE_HOP_SPIN && this.stateName === LatchIdleHopState.name) {
      this.#model.anim.speed = (19 / 30) / this.idleHop.flightDuration;

      return;
    }
    const locomotion = [ANIMATION.WADDLE_WALK, ANIMATION.WADDLE_RUN, ANIMATION.FOLLOW].includes(this.requestedClip);
    if (!locomotion || this.stateName === LatchClipState.name) {
      this.#model.anim.speed = 1;

      return;
    }
    const velocity = this.entity.rigidbody?.linearVelocity;
    const speed = velocity ? Math.hypot(velocity.x, velocity.z) : 0;
    const reference = this.requestedClip === ANIMATION.WADDLE_RUN ? 1.35 : 0.85;
    this.#model.anim.speed = Math.max(0.1, Math.min(2.8, speed / reference));
  }

  /**
   * @param {boolean} entering
   */
  onGatewayArrival(entering) {
    if (entering) {
      this.playClip(ANIMATION.WADDLE_WALK);
    } else if (!this.alive || this.carrier || this.statuses.has("stun")) {
      return;
    } else if (this.definition.testClip) {
      this.testPlayClip(this.definition.testClip);
    } else {
      this.behavior.changeTo(LatchSeekState.name);
    }
  }

  /**
   * @param {number} factor
   */
  limitNearbyMovement(factor) {
    for (const actor of this.actors) {
      if (actor !== this && actor.alive !== false && this.distanceTo(actor) < 1.15) {
        actor.applyStatus?.("slow", {
          duration: 0.2,
          factor,
          source: this,
        });
      }
    }
  }

  /**
   * @param {import("playcanvas").Vec3|null} impact
   */
  splat(impact = null) {
    if (!this.alive || this.carrier || !impact || !this.#doorLeap.active) {
      return false;
    }
    const door = this.doorTarget;
    // Recheck at contact: a door opened during windup must keep the slug alive.
    if (!door || door.broken || door.openAmount > 0.001) {
      this.cancelDoorLeap();

      return false;
    }
    this.residue = new LatchGlue(door, null, this, impact);
    if (!this.residue.active) {
      this.residue = null;
      this.cancelDoorLeap();

      return false;
    }
    this.audio?.play("splash", 0.96 + Math.random() * 0.08);
    this.airborne = false;
    this.#doorLeap.cancel();
    if (this.#model?.anim) {
      this.#model.anim.playing = false;
    }
    this.receiveDamage(this.health, this, "sacrifice");

    return true;
  }

  /**
   * @returns {import("playcanvas").MeshInstance[]}
   */
  getImpactMeshes() {
    return this.#model?.findComponents("render").flatMap(/**
     *
     * @param {import("playcanvas").RenderComponent} render
     */
      (render) => render.meshInstances) ?? [];
  }

  finishSplatTransition() {
    if (this.#model) {
      this.#model.enabled = false;
    }
  }

  /**
   * @returns {import("playcanvas").Vec3|null}
   */
  get leapTarget() {
    return this.#doorLeap.point;
  }

  beginDoorLeap() {
    if (!this.alive || !this.#doorLeap.begin(this.doorTarget)) {
      return false;
    }
    this.behavior.changeTo(LatchLeapState.name);
    this.audio?.play("jump", 0.96 + Math.random() * 0.08);

    return true;
  }

  cancelDoorLeap() {
    this.#doorLeap.cancel();
    this.behavior.changeTo(LatchReactionState.name);
  }

  /**
   * @param {import("playcanvas").ContactResult} result
   */
  onDoorContact(result) {
    // Ammo's manifold order can reverse the normal on castle compound floors.
    // Confirm support by the actual contact point beneath the capsule instead
    // of assuming every floor reports a positive world-space Y normal.
    const supported = result.contacts?.some(/**
       * @param {import("playcanvas").ContactPoint} contact
       */
      (contact) => {
        const point = contact.pointOther ?? contact.point;

        return point && Math.abs(contact.normal?.y ?? 0) > 0.65 &&
          Math.abs(point.y - this.position.y) < 0.15;
      });
    if (this.alive && this.airborne && this.entity.rigidbody.linearVelocity.y <= 0.1 && supported) {
      this.onLanding({ other: result.other });
    }
    return this.alive && this.#doorLeap.contact(result);
  }

  /**
   * @param {{other?:import("playcanvas").Entity}} contact
   */
  onLanding(contact = {}) {
    if (this.airborne && this.entity.rigidbody?.linearVelocity.y > 0.1) {
      this.grounded = false;

      return false;
    }
    this.#doorLeap.cancel();

    return super.onLanding(contact);
  }

  /**
   * @returns {boolean}
   */
  pat() {
    return this.patPresentation?.pat() ?? false;
  }

  /**
   * @param {{onComplete?:()=>void}} options
   */
  findInteraction({ onComplete }) {
    const interaction = new LatchPatInteraction(this, onComplete);

    return interaction.canInteract ? interaction : null;
  }

  clearGlue() {
    this.residue?.clear();
  }

  /**
   * @param {import("playcanvas").Vec3} rayStart
   * @param {import("playcanvas").Vec3} rayEnd
   */
  getPointerHit(rayStart, rayEnd) {
    let hit = this.residue?.getPointerHit(rayStart, rayEnd, this.pc);
    if (!hit && this.affection.canPat && this.#model) {
      const bounds = new this.pc.BoundingBox(this.position.clone().add(new this.pc.Vec3(0, 0.4, 0)), new this.pc.Vec3(0.5, 0.45, 0.5));
      const point = new this.pc.Vec3();
      const length = rayStart.distance(rayEnd);
      if (length > 0 && bounds.intersectsRay(new this.pc.Ray(rayStart, rayEnd.clone().sub(rayStart).normalize()), point) && point.distance(rayStart) <= length) {
        hit = {
          point,
          distance: point.distance(rayStart) / length,
        };
      }
    }

    return hit ? {
      ...hit,
      pointerTarget: this,
    } : null;
  }

  handlePointerDown() {
    if (!this.residue?.active) {
      return this.pat();
    }
    this.clearGlue();

    return true;
  }

  /**
   * @param {Parameters<Enemy["onBellRung"]>[0]} event
   */
  onBellRung(event = {}) {
    const windingUp = this.behavior.currentState instanceof LatchPressState;
    const door = this.doorTarget;
    if (!super.onBellRung(event)) {
      return false;
    }
    if (windingUp && door?.openAmount <= 0.001) {
      this.doorTarget = door;
      this.statuses.delete("confused");
      this.beginDoorLeap();
    } else {
      this.behavior.changeTo(LatchReactionState.name);
    }
    return true;
  }

  /**
   * @param {string} name
   */
  onStatusApplied(name) {
    if (name === ANIMATION.STUN || name === "confused") {
      this.#doorLeap.cancel();
      this.behavior.changeTo(LatchReactionState.name);
      this.playClip(name === ANIMATION.STUN ? ANIMATION.STUN : ANIMATION.STARTLED);
    }
  }

  onCarried() {
    this.#doorLeap.cancel();
    this.behavior.changeTo(LatchReactionState.name);
    this.playClip(ANIMATION.CARRIED_READY);
  }

  onLaunched() {
    this.#doorLeap.cancel();
    this.behavior.changeTo(LatchReactionState.name);
    this.playClip(ANIMATION.AIRBORNE);
  }

  onLanded() {
    if (this.behavior.currentState instanceof LatchIdleHopState) {
      this.behavior.currentState.land(this);

      return;
    }
    this.behavior.changeTo(LatchReactionState.name);
    this.playClip(ANIMATION.LAND);
  }

  /**
   * @returns {boolean}
   */
  beginIdleHop() {
    if (!this.idleHop.eligible || !this.idleHop.clearance) {
      return false;
    }
    this.idleHop.reset();
    this.behavior.changeTo(LatchIdleHopState.name);

    return true;
  }

  /**
   * @returns {boolean}
   */
  launchIdleHop() {
    if (!this.alive || !this.grounded || this.carrier || this.airborne ||
      this.statuses.has("stun") || this.statuses.has("confused") || !this.idleHop.clearance ||
      this.stateName !== LatchIdleHopState.name) {
      return false;
    }
    this.#doorLeap.cancel();
    this.airborne = true;
    this.grounded = false;
    this.entity.rigidbody.linearVelocity = new this.pc.Vec3(0, this.idleHop.lift, 0);
    this.playClip(ANIMATION.IDLE_HOP_SPIN);
    this.audio?.play("idleHop", 0.96 + Math.random() * 0.08);

    return true;
  }

  onDamaged() {
    if (this.alive) {
      this.behavior.changeTo(LatchReactionState.name);
      this.playClip(ANIMATION.HIT);
    }
  }

  onDeath() {
    this.#doorLeap.cancel();
    this.behavior.changeTo(LatchDeadState.name);
  }

  destroy() {
    this.gatewayArrival.finish();
    this.#stairSurface?.destroy();
    this.#groundCrawl?.destroy();
    this.patPresentation?.destroy();
    this.gaze?.destroy();
    this.#jelly?.destroy();
    this.#trail?.destroy();
    this.#doorContact?.off();
    this.#navigation.destroy();
    this.#playbackCheck?.destroy();
    this.clearGlue();
    this.splash?.destroy();
    this.splash = null;
    super.destroy();
  }
}
