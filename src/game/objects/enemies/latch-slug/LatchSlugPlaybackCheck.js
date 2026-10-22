import { LATCH_SLUG_ANIMATION } from "./LatchSlugAnimation.js";

/**
 * Samples actual rendered-hierarchy joints while every embedded clip plays.
 */
export class LatchSlugPlaybackCheck {
  /**
   * @type {Array<{name:string,duration:number}>}
   */
  #clips;
  /**
   * @type {import("./LatchSlug.js").LatchSlug}
   */
  #owner;
  /**
   * @type {import("playcanvas").Entity}
   */
  #model;
  /**
   * @type {import("playcanvas").EventHandle|null}
   */
  #handle = null;
  /**
   * @type {number}
   */
  #index = -1;
  /**
   * @type {number}
   */
  #age = 0;
  /**
   * @type {Array<{clip:string,frames:number,jointPoses:Set<string>,finite:boolean,duration:number}>}
   */
  #results = [];
  /**
   * @type {import("playcanvas").Entity[]}
   */
  #joints;

  /**
   * @param {import("./LatchSlug.js").LatchSlug} owner
   * @param {import("playcanvas").Entity} model
   */
  constructor(owner, model) {
    this.#owner = owner;
    this.#model = model;
    this.#clips = [];
    for (const [name, track] of owner.modelLibrary.getAnimationTracks(owner.constructor.modelUrls[0], Object.values(LATCH_SLUG_ANIMATION))) {
      this.#clips.push({
        name,
        duration: track.duration,
      });
    }
    this.#joints = ["body", "head", "antenna_L", "antenna_R", "tail", "paw_front_L", "paw_front_R"].map(
      /**
       * @param {string} name
       */ (name) => model.findByName(name));
  }

  /**
   * @returns {string}
   */
  get status() {
    if (this.#handle) {
      return `Playback check ${this.#index + 1}/${this.#clips.length}: ${this.#clips[this.#index].name}`;
    }
    const passed = this.#results.filter(LatchSlugPlaybackCheck.#passed).length;

    return this.#results.length ? `Playback: ${passed}/${this.#results.length} clips have finite playback and joint motion` : "";
  }

  start() {
    this.destroy();
    this.#results = [];
    this.#index = -1;
    this.#next();
    this.#handle = this.#owner.app.on("update", this.#update, this);
  }

  /**
   * @param {number} dt
   */
  #update(dt) {
    if (!this.#owner.alive) {
      this.destroy();

      return;
    }
    this.#age += dt;
    const result = this.#results[this.#index];
    const layer = this.#model.anim.baseLayer;
    result.finite &&= Number.isFinite(layer.activeStateCurrentTime) && Number.isFinite(this.#model.anim.speed);
    result.frames++;
    result.jointPoses.add(this.#joints.map(LatchSlugPlaybackCheck.#jointPose).join(";"));
    if (this.#age >= result.duration + 0.15) {
      this.#next();
    }
  }

  #next() {
    this.#index++;
    if (this.#index >= this.#clips.length) {
      this.destroy();
      this.#download();

      return;
    }
    const clip = this.#clips[this.#index];
    this.#owner.testPlayClip(clip.name);
    this.#model.anim.baseLayer.transition(clip.name, 0);
    this.#age = 0;
    this.#results.push({
      clip: clip.name,
      duration: clip.duration,
      frames: 0,
      jointPoses: new Set(),
      finite: true,
    });
  }

  #download() {
    const results = this.#results.map(LatchSlugPlaybackCheck.#serialize);
    console.log(`Latch Slug playback: ${JSON.stringify({
      route: location.pathname,
      engine: "production PlayCanvas",
      results,
    })}`);
    const link = document.createElement("a");
    link.download = "latch-slug-game-playback.json";
    const url = URL.createObjectURL(new Blob([JSON.stringify({
      route: location.pathname,
      engine: "production PlayCanvas",
      results,
    }, null, 2)], { type: "application/json" }));
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  destroy() {
    this.#handle?.off();
    this.#handle = null;
  }

  /**
   * @param {{frames:number,jointPoses:Set<string>,finite:boolean}} result
   * @returns {boolean}
   */
  static #passed(result) {
    return result.frames >= 3 && result.jointPoses.size > 1 && result.finite;
  }

  /**
   * @param {{clip:string,frames:number,jointPoses:Set<string>,finite:boolean,duration:number}} result
   * @returns {{clip:string,frames:number,distinctJointPoses:number,finite:boolean,duration:number,passed:boolean}}
   */
  static #serialize(result) {
    return {
      clip: result.clip,
      frames: result.frames,
      distinctJointPoses: result.jointPoses.size,
      finite: result.finite,
      duration: result.duration,
      passed: LatchSlugPlaybackCheck.#passed(result),
    };
  }

  /**
   * @param {import("playcanvas").Entity|null} joint
   * @returns {string}
   */
  static #jointPose(joint) {
    if (!joint) {
      return "missing";
    }
    const rotation = joint.getLocalRotation();
    const position = joint.getLocalPosition();
    const scale = joint.getLocalScale();

    return [rotation.x, rotation.y, rotation.z, rotation.w, position.x, position.y, position.z, scale.x, scale.y, scale.z].map(LatchSlugPlaybackCheck.#rounded).join(",");
  }

  /**
   * @param {number} value
   * @returns {string}
   */
  static #rounded(value) {
    return value.toFixed(5);
  }
}
