import { HERO_ANIMATION } from "../../../enum/HeroAnimation.js";

const ANIMATION_BLEND_TIME = 0.14;
const HERO_ANIMATION_NAMES = Object.freeze(Object.values(HERO_ANIMATION));
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

  get state() {
    return this.#state;
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
    modelRoot.addComponent("anim", { activate: true });
    this.#animation = modelRoot.anim;
    for (const [name, track] of tracks) {
      if (!HERO_ANIMATION_NAMES.includes(name)) {
        continue;
      }
      this.#animation.addAnimationState(name, track, 1, LOOPING_ANIMATIONS.has(name));
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
   */
  play(name, speed, restart) {
    const animation = this.#animation;
    if (!animation) {
      return;
    }
    animation.speed = speed;
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
    animation.baseLayer.transition(name, ANIMATION_BLEND_TIME);
    this.#state = name;
  }

  destroy() {
    this.#animation = null;
    this.#state = null;
  }

  /**
   * @param {string} name
   * @returns {boolean}
   */
  static #requiredAnimation(name) {
    return name !== HERO_ANIMATION.DIG_OPPOSITE;
  }
}
