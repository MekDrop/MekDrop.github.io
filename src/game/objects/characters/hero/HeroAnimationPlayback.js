import { HERO_ANIMATION } from "../../../enum/HeroAnimation.js";

const ANIMATION_BLEND_TIME = 0.14;
const HERO_ANIMATION_NAMES = Object.freeze(Object.values(HERO_ANIMATION));
const RUN_STOP_ANIMATIONS = new Set([HERO_ANIMATION.RUN_STOP_LEFT, HERO_ANIMATION.RUN_STOP_RIGHT]);
const GAITS = new Set([HERO_ANIMATION.WALK, HERO_ANIMATION.RUN]);
export const LADDER_TOP_ANIMATIONS = new Set([
  HERO_ANIMATION.CLIMB_TOP,
  HERO_ANIMATION.CLIMB_TOP_RIGHT,
]);
const LOOPING_ANIMATIONS = new Set([
  HERO_ANIMATION.CLIMB,
  HERO_ANIMATION.IDLE,
  HERO_ANIMATION.WALK,
  HERO_ANIMATION.RUN,
  HERO_ANIMATION.BLOCKED_PUSH,
]);

/**
 * Owns model clip registration and playback transitions.
 * The model hierarchy and its animation component are destroyed by Hero.
 */
export class HeroAnimationPlayback {
  /**
   * @type {import("playcanvas").AnimComponent|null}
   */
  #animation = null;
  /**
   * @type {string|null}
   */
  #state = null;
  /**
   * @type {Map<string, number>}
   */
  #durations = new Map();

  get state() {
    return this.#state;
  }

  /**
   * @returns {number}
   */
  get phase() {
    const duration = this.#durations.get(this.#state);

    return duration > 0 ? (this.#animation.baseLayer.activeStateCurrentTime % duration) / duration : 0;
  }

  /**
   * @param {import("playcanvas").Entity} modelRoot
   * @param {import("../../../models/GameModelLibrary.js").GameModelLibrary} modelLibrary
   * @param {string} modelUrl
   * @returns {Map<string, import("playcanvas").AnimTrack>}
   */
  initialize(modelRoot, modelLibrary, modelUrl) {
    const tracks = modelLibrary.getAnimationTracks(modelUrl,
      HERO_ANIMATION_NAMES.filter(HeroAnimationPlayback.#requiredAnimation));
    // Uncalibrated character variants may only provide the original tool clip.
    if (!tracks.has(HERO_ANIMATION.DIG_OPPOSITE)) {
      tracks.set(HERO_ANIMATION.DIG_OPPOSITE, tracks.get(HERO_ANIMATION.DIG));
    }
    for (const name of RUN_STOP_ANIMATIONS) {
      if (!tracks.has(name)) {
        tracks.set(name, tracks.get(HERO_ANIMATION.IDLE));
      }
    }
    modelRoot.addComponent("anim", { activate: true });
    this.#animation = modelRoot.anim;
    for (const [name, track] of tracks) {
      if (!HERO_ANIMATION_NAMES.includes(name)) {
        continue;
      }
      this.#animation.addAnimationState(name, track, 1, LOOPING_ANIMATIONS.has(name));
      this.#durations.set(name, track.duration);
    }
    this.#animation.baseLayer.play(HERO_ANIMATION.IDLE);
    this.#state = HERO_ANIMATION.IDLE;

    return tracks;
  }

  /**
   *
   * @param {string} name
   * @param {number} speed
   * @param {boolean} restart
   * @param {number|null} [duration]
   */
  play(name, speed, restart, duration = null) {
    const animation = this.#animation;
    if (!animation) {
      return;
    }
    animation.speed = duration > 0 ? this.#durations.get(name) / duration : speed;
    animation.baseLayer.playing = !LADDER_TOP_ANIMATIONS.has(name);
    if (
      restart ||
      (this.#state !== name &&
        (LADDER_TOP_ANIMATIONS.has(name) || LADDER_TOP_ANIMATIONS.has(this.#state)))
    ) {
      // Keep interrupted clips alive until the controller completes the transition.
      animation.baseLayer.transition(name, 0);
      this.#state = name;

      return;
    }
    if (this.#state === name) {
      return;
    }
    // Keep the same supporting leg when changing between the two cyclic gaits.
    const phase = GAITS.has(name) && GAITS.has(this.#state) ? this.phase : null;
    const blendTime = phase !== null ? 0.22 : RUN_STOP_ANIMATIONS.has(name) ? 0.08 : ANIMATION_BLEND_TIME;
    animation.baseLayer.transition(name, blendTime, phase);
    this.#state = name;
  }

  destroy() {
    this.#animation = null;
    this.#state = null;
    this.#durations.clear();
  }

  /**
   * @param {string} name
   * @returns {boolean}
   */
  static #requiredAnimation(name) {
    return !RUN_STOP_ANIMATIONS.has(name) &&
      name !== HERO_ANIMATION.DIG_OPPOSITE;
  }
}
