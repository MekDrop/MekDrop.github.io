import kingModelUrl from "../../../../models/castle/royals/king.glb?url";
import { KING_ANIMATION } from "../../../../enum/KingAnimation.js";
import { KingTerracePerformance } from "./KingTerracePerformance.js";
import { KingTrainingClips } from "./KingTrainingClips.js";
import { TerraceActor } from "./TerraceActor.js";
import { CastleAudio } from "../../../../audio/castle/CastleAudio.js";
import { GameObjectAudio } from "../../../../audio/GameObjectAudio.js";
import { KingTrainingExpression } from "./KingTrainingExpression.js";

/**
 * Owns the king model, its embedded animation player, and roof routine.
 */
export class TerraceKing {
  /**
   * @type {number}
   */
  #visualYaw = 0;
  /**
   * @type {number|null}
   */
  #poseTime = null;
  /**
   * @type {KingTrainingExpression|null}
   */
  #expression = null;
  /**
   * @type {GameObjectAudio|null}
   */
  #audio = null;
  /**
   * @type {number|null}
   */
  #soundTime = null;
  /**
   * @type {string|null}
   */
  #soundClip = null;
  /**
   *
    * @returns {string}
   */
  static get kind() {
    return "king";
  }

  /**
   *
    * @returns {string}
   */
  static get modelUrl() {
    return kingModelUrl;
  }

  /**
   *
    * @type {TerraceActor|null}
   */
  #actor;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #performanceFrame = null;
  /**
   *
    * @type {KingTerracePerformance|null}
   */
  #performance;
  /**
   *
    * @type {import("playcanvas").AnimController|null}
   */
  #animationLayer;
  /**
   *
    * @type {string}
   */
  #animationName;
  /**
   *
    * @type {string}
   */
  #animationStep = "idle";
  /**
   *
    * @type {string}
   */
  #action;
  /**
   *
    * @type {{x: number, y: number, z: number}}
   */
  #performanceOrigin;
  /**
   *
    * @type {{x: number, y: number, z: number}}
   */
  #performanceRotation;
  /**
   *
    * @type {import("src/game/objects/ObjectTypes.js").Point3|null}
   */
  #lastOffset = {
    x: 0,
    y: 0,
    z: 0,
  };
  /**
   *
    * @type {number}
   */
  #lastYaw = 0;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), modelLibrary: string, performanceSeed: number|string}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {string} options.modelLibrary
   * @param {number|string} options.performanceSeed
   */
  constructor({ pc, modelLibrary, performanceSeed, app, runtime }) {
    this.#actor = new TerraceActor({
      pc,
      modelLibrary,
      modelUrl: kingModelUrl,
      kind: TerraceKing.kind,
    });
    this.#performance = new KingTerracePerformance();
    this.#setupAnimations(modelLibrary);
    if (app) {
      this.#expression = new KingTrainingExpression(this.model, app);
    }
    if (app && runtime?.audioLibrary) {
      this.#audio = new GameObjectAudio(this.entity, app, runtime.audioLibrary, {
        stoneStep1: CastleAudio.stoneStep1,
        stoneStep2: CastleAudio.stoneStep2,
      }, 0.22);
      this.#audio.follow(() => runtime.objects.getOne("hero")?.position ?? null);
    }
  }

  /**
   * @param {import("playcanvas").Entity} value
   */
  set performanceFrame(value) {
    this.#performanceFrame = value;
  }

  /**
   * @returns {import("playcanvas").Entity}
   */
  get model() {
    return this.#actor.model;
  }

  /**
   * @returns {import("../../../shared/NpcStateMachine.js").NpcStateMachine}
   */
  get behavior() {
    return this.#actor.behavior;
  }

  /**
   * @param {import("../../../shared/NpcStateMachine.js").NpcStateMachine} value
   */
  set behavior(value) {
    this.#actor.behavior = value;
    if (value && "trainingRoutine" in value) {
      value.trainingRoutine = this.#performance.routine;
    }
  }

  /**
   * @returns {import("playcanvas").Entity}
   */
  get entity() {
    return this.#actor.entity;
  }

  /**
   * Resume travel from the visible doorway sidestep.
   * @returns {boolean}
   */
  settleNavigationOffset() {
    return this.#actor.settleNavigationOffset();
  }

  /**
   *
    * @returns {number}
   */
  get rightHand() {
    return this.#actor.rightHand;
  }

  /**
   *
    * @returns {import("playcanvas").Entity|null}
   */
  get leftHand() {
    return this.#actor.leftHand;
  }

  /**
   *
    * @returns {import("playcanvas").Entity|null}
   */
  get head() {
    return this.#actor.head;
  }

  /**
   *
    * @returns {number}
   */
  get height() {
    return this.#actor.height;
  }

  /**
   *
   * @param {string} action
   * @param {number} time
   * @param {number} blend
   */
  pose(action, time = 0, blend = 1) {
    if (action !== this.#action) {
      this.#action = action;
      this.#poseTime = null;
      this.#visualYaw = 0;
      this.#performanceOrigin = action === "sword"
        ? this.entity.getLocalPosition().clone()
        : null;
      this.#performanceRotation = action === "sword"
        ? this.entity.getLocalEulerAngles().clone()
        : null;
      if (action !== "sword") {
        this.#lastOffset = {
          x: 0,
          y: 0,
          z: 0,
        };
        this.#lastYaw = 0;
      }
    }
    const sample = this.#performance.sample(action, time, blend, {
      clip: this.#animationLayer.activeState,
      time: this.#animationLayer.activeStateCurrentTime ?? 0,
    });
    this.#expression?.pose(action, sample.clip);
    this.#play(sample.clip, sample.sequenceStep, action === "walk" ? 0.75 : sample.failed ? 1.25 : sample.speed ?? 1);
    const contacts = KingTrainingClips.contacts(sample.clip);
    if (sample.clip !== this.#soundClip) {
      this.#soundTime = null;
      this.#soundClip = sample.clip;
    }
    if (contacts.length) {
      const elapsed = this.#animationLayer.activeStateCurrentTime ?? 0;
      const duration = KingTrainingClips.duration(sample.clip);
      const phase = Math.min(elapsed, duration);
      const previous = this.#soundTime;
      if (previous !== null) {
        // These are the baked foot landings, not the blade strokes.
        for (const [index, contact] of contacts.entries()) {
          const crossed = phase >= previous ? previous < contact && phase >= contact
            : previous < contact || phase >= contact;
          if (crossed) {
            this.#audio?.play(`stoneStep${index % 2 + 1}`);
          }
        }
      }
      this.#soundTime = phase;
    } else {
      this.#soundTime = null;
    }
    if (action !== "sword" || !this.#performanceOrigin) {
      return;
    }

    let offset = sample.offset;
    let yaw = sample.yaw;
    if (sample.sequenceStep === "rise") {
      offset = {
        x: this.#lastOffset.x * blend,
        y: this.#lastOffset.y * blend,
        z: this.#lastOffset.z * blend,
      };
      yaw = this.#lastYaw * blend;
    } else if (typeof sample.sequenceStep === "number") {
      this.#lastOffset = sample.offset;
      this.#lastYaw = sample.yaw;
    }
    if (this.#performanceFrame) {
      const vector = this.entity.getLocalPosition().clone().set(offset.x, offset.y, offset.z);
      this.#performanceFrame.getWorldTransform().transformVector(vector, vector);
      this.entity.parent.getWorldTransform().clone().invert().transformVector(vector, vector);
      offset = vector;
    }
    this.entity.setLocalPosition(
      this.#performanceOrigin.x + offset.x,
      this.#performanceOrigin.y + offset.y,
      this.#performanceOrigin.z + offset.z,
    );
    const dt = this.#poseTime === null ? 0 : Math.min(0.05, Math.max(0, time - this.#poseTime));
    this.#poseTime = time;
    const error = ((yaw - this.#visualYaw) % 360 + 540) % 360 - 180;
    this.#visualYaw += Math.max(-90 * dt, Math.min(90 * dt, error));
    this.entity.setLocalEulerAngles(
      this.#performanceRotation.x,
      this.#performanceRotation.y + this.#visualYaw,
      this.#performanceRotation.z,
    );
  }

  /**
   * @returns {number}
   */
  get stamina() {
    return this.#performance.stamina;
  }

  /**
   * @param {number} value
   */
  set stamina(value) {
    this.#performance.stamina = value;
  }

  /**
   * @returns {boolean}
   */
  get resting() {
    return this.#performance.resting;
  }

  destroy() {
    this.#expression?.destroy();
    this.#expression = null;
    this.#actor.destroy();
    this.#actor = null;
    this.#performance = null;
    this.#animationLayer = null;
    this.#performanceOrigin = null;
    this.#performanceRotation = null;
  }

  /**
   *
   * @param {string} modelLibrary
   */
  #setupAnimations(modelLibrary) {
    const names = Object.values(KING_ANIMATION);
    const tracks = modelLibrary.getAnimationTracks(kingModelUrl, names);
    const model = this.#actor.model;
    model.addComponent("anim", { activate: true });
    for (const name of names) {
      const looping = [
        KING_ANIMATION.TERRACE_IDLE,
        KING_ANIMATION.TERRACE_WALK,
        KING_ANIMATION.SWORD_READY,
        KING_ANIMATION.SWORD_TRAINING_DRILL,
        KING_ANIMATION.GROUND_REST,
      ].includes(name);
      model.anim.addAnimationState(name, tracks.get(name), 1, looping);
    }
    this.#animationLayer = model.anim.baseLayer;
    this.#animationLayer.play(KING_ANIMATION.TERRACE_IDLE);
    this.#animationName = KING_ANIMATION.TERRACE_IDLE;
  }

  /**
   *
   * @param {string} name
   * @param {string|number} sequenceStep
   * @param {number} speed
   */
  #play(name, sequenceStep, speed) {
    this.#actor.model.anim.speed = speed;
    if (name === this.#animationName && sequenceStep === this.#animationStep && this.#animationLayer.activeState === name) {
      return;
    }
    if (name === this.#animationName) {
      this.#animationLayer.play(name);
    } else {
      this.#animationLayer.transition(name, 0.12);
    }
    this.#animationName = name;
    this.#animationStep = sequenceStep;
  }
}
