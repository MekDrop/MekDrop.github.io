/**
 * Plays authored tracks on the exact hierarchy instantiated by GameModelLibrary.
 */
export class HammerAnimationPlayback {
  /**
   * @type {import("playcanvas").AnimComponent}
   */
  #animation;
  /**
   * @type {string|null}
   */
  #current = null;
  /**
   * @type {Set<string>}
   */
  #names;
  /**
   * @type {Map<string,number>}
   */
  #durations = new Map();

  /**
   * @param {import("playcanvas").Entity} model
   * @param {import("../../../models/GameModelLibrary.js").GameModelLibrary} library
   * @param {string} url
   * @param {{name:string,looping:boolean}[]} clips
   */
  constructor(model, library, url, clips) {
    this.#names = new Set(clips.map(/**
     *
     * @param {{name:string,looping:boolean}} clip
     */
      (clip) => clip.name));
    const tracks = library.getAnimationTracks(url, [...this.#names]);
    model.addComponent("anim", { activate: true });
    this.#animation = model.anim;
    for (const clip of clips) {
      const track = tracks.get(clip.name);
      this.#animation.addAnimationState(clip.name, track, 1, clip.looping);
      this.#durations.set(clip.name, track.duration);
    }
    this.#animation.baseLayer.play("idle");
    this.#current = "idle";
  }

  /**
   * @param {string} name
   * @param {boolean} restart
   * @param {number|null} duration
   */
  play(name, restart = false, duration = null) {
    if (!this.#names.has(name)) {
      return false;
    }
    this.#animation.speed = duration > 0 ? this.#durations.get(name) / duration : 1;
    if (name === this.#current && !restart) {
      return true;
    }
    this.#animation.baseLayer.transition(name, restart ? 0 : 0.1);
    this.#current = name;

    return true;
  }

  /**
   * @returns {{clip:string|null,time:number,speed:number}}
   */
  get status() {
    return {
      clip:this.#current,
      time:this.#animation.baseLayer.activeStateCurrentTime,
      speed:this.#animation.speed,
    };
  }

  /**
   * @returns {ReadonlyMap<string,number>}
   */
  get durations() {
    return this.#durations;
  }

  /**
   * @param {number} phase
   */
  sample(phase) {
    this.#animation.baseLayer.activeStateCurrentTime = this.#durations.get(this.#current) * Math.min(1, Math.max(0, phase));
    this.#animation.speed = 0;
  }

  destroy() {
    this.#animation = null;
    this.#names.clear();
    this.#durations.clear();
  }
}
