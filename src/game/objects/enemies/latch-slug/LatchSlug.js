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
const LOOPING_CLIPS = new Set([
  ANIMATION.IDLE_DOG, ANIMATION.WADDLE_WALK, ANIMATION.WADDLE_RUN, ANIMATION.PANT,
  ANIMATION.SIT_LOOP, ANIMATION.FOLLOW, ANIMATION.ANTENNA_WAG, ANIMATION.STUN,
  ANIMATION.CARRIED_READY, ANIMATION.AIRBORNE, ANIMATION.INFLATE_LOOP,
]);

/**
 * Map-owned nuisance behavior with the authored Tripo mesh and embedded clips.
 */
export class LatchSlug extends Enemy {
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #model = null;
  /**
   * @type {LatchSlugPlaybackCheck|null}
   */
  #playbackCheck = null;

  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [new URL("../../../models/enemies/latch-slug/latch-slug.glb", import.meta.url).href];
  }
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

    this.radius = 0.42;
    // Ammo clamps a capsule shorter than its diameter to a sphere. Matching the
    // diameter keeps its bottom at the model's grounded semantic root.
    this.height = this.radius * 2;
    const position = options.definition.position;
    if (position) {
      this.entity.setPosition(position.x, position.y ?? 0, position.z);
    }
    for (const StateClass of [LatchSeekState, LatchDogState, LatchPressState, LatchReactionState, LatchDeadState, LatchClipState]) {
      this.behavior.add(StateClass.name, new StateClass());
    }
    this.behavior.changeTo(LatchSeekState.name);
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
    super.onSceneReady();
    if (this.definition.testClip) {
      this.testPlayClip(this.definition.testClip);
    }
  }

  /**
   * @returns {string}
   */
  get testStatus() {
    const layer = this.#model?.anim?.baseLayer;

    return this.#playbackCheck?.status || `${super.testStatus}\n${this.requestedClip} ${(layer?.activeStateCurrentTime ?? 0).toFixed(2)}s`;
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
    for (const actor of this.actors) {
      for (const door of actor.entranceDoors ?? []) {
        const candidate = this.distanceTo(door);
        if (candidate < distance) {
          distance = candidate;
          nearest = door;
        }
      }
    }

    return nearest;
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
   * @param {number} dt
   */
  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) {
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
  }

  /**
   * @param {number} factor
   */
  limitNearbyMovement(factor) {
    for (const actor of this.actors) {
      if (actor !== this && actor.alive !== false && this.distanceTo(actor) < 0.85) {
        actor.applyStatus?.("slow", {
          duration: 0.2,
          factor,
          source: this,
        });
      }
    }
  }

  splat() {
    if (!this.alive) {
      return false;
    }
    const door = this.doorTarget;
    // Recheck at contact: a door opened during windup must keep the slug alive.
    if (!door || door.openAmount > 0.001 || this.distanceTo(door) > 1.4) {
      this.behavior.changeTo(LatchDogState.name);

      return false;
    }
    this.residue = new LatchGlue(door);
    if (!this.residue.active) {
      this.residue = null;
      this.behavior.changeTo(LatchDogState.name);

      return false;
    }
    this.receiveDamage(this.health, this, "sacrifice");

    return true;
  }

  clearGlue() {
    this.residue?.clear();
  }

  /**
   * @param {Parameters<Enemy["onBellRung"]>[0]} event
   */
  onBellRung(event = {}) {
    const windingUp = this.behavior.currentState instanceof LatchPressState;
    if (!super.onBellRung(event)) {
      return false;
    }
    if (windingUp && this.doorTarget?.openAmount <= 0.001) {
      this.splat();
    } else {
      this.behavior.changeTo(LatchReactionState.name);
    }
    return true;
  }

  /**
   * @param {string} name
   */
  onStatusApplied(name) {
    if (name === ANIMATION.STUN) {
      this.behavior.changeTo(LatchReactionState.name);
    }
  }

  onCarried() {
    this.behavior.changeTo(LatchReactionState.name);
    this.playClip(ANIMATION.CARRIED_READY);
  }

  onLaunched() {
    this.behavior.changeTo(LatchReactionState.name);
    this.playClip(ANIMATION.AIRBORNE);
  }

  onLanded() {
    this.behavior.changeTo(LatchReactionState.name);
    this.playClip(ANIMATION.LAND);
  }

  onDeath() {
    this.behavior.changeTo(LatchDeadState.name);
  }

  destroy() {
    this.#playbackCheck?.destroy();
    this.clearGlue();
    super.destroy();
  }
}
