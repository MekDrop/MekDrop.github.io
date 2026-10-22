import { wireGremlinClips } from "./WireGremlinClips.js";
import { WireGremlinPreview } from "./WireGremlinPreview.js";

/**
 * Samples actual rendered-hierarchy joints while every embedded clip plays.
 */
export class WireGremlinPlaybackCheck {
  /**
   * @type {import("./WireGremlin.js").WireGremlin}
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
   * @type {boolean}
   */
  #captured = false;
  /**
   * @type {boolean}
   */
  #capturing = false;
  /**
   * @type {Array<{clip:string,frames:number,jointPoses:Set<string>,finite:boolean,duration:number}>}
   */
  #results = [];
  /**
   * @type {import("playcanvas").Entity[]}
   */
  #joints;

  /**
   * @param {import("./WireGremlin.js").WireGremlin} owner
   * @param {import("playcanvas").Entity} model
   */
  constructor(owner, model) {
    this.#owner = owner;
    this.#model = model;
    this.#joints = ["Head", "LeftArm", "RightArm", "LeftLeg", "RightLeg"].map(
      /**
       * @param {string} name
       */ (name) => model.findByName(`mixamorig:${name}`));
  }

  /**
   * @returns {string}
   */
  get status() {
    if (this.#handle) {
      return `Playback check ${this.#index + 1}/${wireGremlinClips.length}: ${wireGremlinClips[this.#index].name}`;
    }
    const passed = this.#results.filter(WireGremlinPlaybackCheck.#passed).length;

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
    result.jointPoses.add(this.#joints.map(WireGremlinPlaybackCheck.#jointPose).join(";"));
    const captureFraction = result.clip === "death" ? 0.95 : 0.4;
    if (!this.#captured && this.#age >= result.duration * captureFraction) {
      this.#captured = true;
      this.#capturing = true;
      WireGremlinPreview.capture(this.#owner, { download: false }).then(
        /**
         * @param {{dataUrl:string,visible:number,transparent:number}} pose
         */
        (pose) => console.log(`Wire Gremlin pose: ${JSON.stringify({
          clip: result.clip,
          ...pose,
        })}`),
      ).catch(/**
       * @param {Error} error
       */ (error) => console.error("Wire Gremlin pose capture failed", error)).finally(() => {
        this.#capturing = false;
      });
    }
    if (!this.#capturing && this.#age >= result.duration + 0.15) {
      this.#next();
    }
  }

  #next() {
    this.#index++;
    if (this.#index >= wireGremlinClips.length) {
      this.destroy();
      this.#download();

      return;
    }
    const clip = wireGremlinClips[this.#index];
    this.#owner.testPlayClip(clip.name);
    this.#model.anim.baseLayer.transition(clip.name, 0);
    this.#age = 0;
    this.#captured = false;
    this.#results.push({
      clip: clip.name,
      duration: clip.duration,
      frames: 0,
      jointPoses: new Set(),
      finite: true,
    });
  }

  #download() {
    const results = this.#results.map(WireGremlinPlaybackCheck.#serialize);
    console.log(`Wire Gremlin playback: ${JSON.stringify({
      route: location.pathname,
      engine: "production PlayCanvas",
      results,
    })}`);
    const link = document.createElement("a");
    link.download = "wire-gremlin-game-playback.json";
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
      passed: WireGremlinPlaybackCheck.#passed(result),
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

    return [rotation.x, rotation.y, rotation.z, rotation.w].map(WireGremlinPlaybackCheck.#rounded).join(",");
  }

  /**
   * @param {number} value
   * @returns {string}
   */
  static #rounded(value) {
    return value.toFixed(5);
  }
}
