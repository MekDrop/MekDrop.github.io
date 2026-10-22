import { BELL_BUG_ANIMATION } from "./BellBugAnimation.js";

/**
 * Frame-based evidence from the running production animation system.
 */
export class BellBugPlaybackVerification {
  /**
   * @param {import("./BellBug.js").BellBug} owner
   */
  constructor(owner) {
    this.owner = owner;
  }

  /**
   * @returns {Promise<Array<{name:string,finite:boolean,time:number,movingJoints:string[]}>>}
   */
  async run() {
    const owner = this.owner;
    const model = owner.animationPlayback.model;
    const names = ["shell", "head", "leg_L_0", "leg_L_1", "leg_R_0", "leg_R_1"];
    const records = [];
    for (const name of Object.values(BELL_BUG_ANIMATION)) {
      owner.inspectClip(name);
      await this.#frame();
      const before = names.map(/**
       *
       * @param {string} joint
       */
        (joint) => this.#pose(model.findByName(joint)));
      const moving = new Set();
      for (let frame = 0; frame < 16; frame++) {
        await this.#frame();
        for (const [i, joint] of names.entries()) {
          const pose = this.#pose(model.findByName(joint));
          const changed = pose.some(/**
           *
           * @param {number} value
           * @param {number} axis
           */
            (value, axis) => Math.abs(value - before[i][axis]) > 0.00001);
          if (changed) {
            moving.add(joint);
          }
        }
      }
      const layer = model.anim.baseLayer;
      records.push({
        name,
        finite: Number.isFinite(layer.activeStateCurrentTime) && Number.isFinite(model.anim.speed),
        time: layer.activeStateCurrentTime,
        movingJoints: [...moving],
      });
    }
    owner.inspectClip("idle_nervous");

    return records;
  }

  /**
   * @returns {Promise<void>}
   */
  #frame() {
    return new Promise(/**
     *
     * @param {()=>void} resolve
     */
      (resolve) => this.owner.app.once("postrender", resolve));
  }

  /**
   * @param {import("playcanvas").GraphNode} joint
   * @returns {number[]}
   */
  #pose(joint) {
    return [...joint.getLocalTransform().data];
  }
}
