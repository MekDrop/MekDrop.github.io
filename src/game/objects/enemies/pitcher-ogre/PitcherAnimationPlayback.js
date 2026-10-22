import { pitcherClips } from "./PitcherClips.js";

/**
 * Embedded tracks share the rendered hierarchy; physics never animates bones.
 */
export class PitcherAnimationPlayback {
  /**
   * @type {string|null}
   */
  #current = null;
  /**
   * @type {number}
   */
  #overrideUntil = 0;

  /**
   * @param {import("playcanvas").Entity} model
   * @param {import("../../../models/GameModelLibrary.js").GameModelLibrary} library
   * @param {string} url
   */
  constructor(model, library, url) {
    this.model = model;
    const tracks = library.getAnimationTracks(url, pitcherClips.map(PitcherAnimationPlayback.#name));
    model.addComponent("anim", { activate: true });
    for (const clip of pitcherClips) {
      model.anim.addAnimationState(clip.name, tracks.get(clip.name), 1, clip.loop);
    }
    model.anim.baseLayer.play("idle");
    this.#current = "idle";
  }

  /**
   * @param {string} name
   * @param {number} speed
   */
  play(name, speed = 1) {
    this.model.anim.speed = speed;
    if (this.#overrideUntil > 0 || this.#current === name) {
      return;
    }
    this.model.anim.baseLayer.transition(name, 0.08);
    this.#current = name;
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    this.#overrideUntil = Math.max(0, this.#overrideUntil - dt);
  }

  resume() {
    this.#overrideUntil = 0;
    this.#current = null;
  }

  /**
   * @param {string} name
   * @returns {boolean}
   */
  inspect(name) {
    const clip = pitcherClips.find(/**
     *
       * @param {{name: string, duration: number}} entry
     */
      (entry) => entry.name === name);
    if (!clip) {
      return false;
    }
    this.#overrideUntil = 0;
    this.model.anim.baseLayer.transition(name, 0);
    this.model.anim.speed = 1;
    this.#current = name;
    this.#overrideUntil = Math.max(2, clip.duration * 2);

    return true;
  }

  /**
   * @param {{name: string}} clip
   * @returns {string}
   */
  static #name(clip) {
    return clip.name;
  }
}
