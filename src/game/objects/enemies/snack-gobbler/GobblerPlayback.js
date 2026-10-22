import { gobblerClips } from "./GobblerClips.js";

/**
 * Embedded clips animate the same hierarchy that the model library renders.
 */
export class GobblerPlayback {
  /**
   * @type {string|null}
   */
  #current = null;

  /**
   * @param {import("playcanvas").Entity} model
   * @param {import("../../../models/GameModelLibrary.js").GameModelLibrary} library
   * @param {string} url
   */
  constructor(model, library, url) {
    this.model = model;
    const tracks = library.getAnimationTracks(url, gobblerClips.map(GobblerPlayback.#name));
    model.addComponent("anim", { activate: true });
    for (const clip of gobblerClips) {
      model.anim.addAnimationState(clip.name, tracks.get(clip.name), 1, clip.loop);
    }
    this.play("idle");
  }

  /**
   * @param {string} name
   * @param {boolean} restart
   */
  play(name, restart = false) {
    if (this.#current === name && !restart) {
      return;
    }
    this.model.anim.baseLayer.transition(name, restart ? 0 : 0.08);
    this.#current = name;
  }

  /**
   * @param {{name:string}} clip
   * @returns {string}
   */
  static #name(clip) {
    return clip.name;
  }
}
