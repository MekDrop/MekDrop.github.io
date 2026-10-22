import { pitcherClips } from "./PitcherClips.js";

/**
 * Records real Engine joint motion, not merely advancing clip names.
 */
export class PitcherPlaybackAudit {
  /**
   * @param {import("./PitcherOgre.js").PitcherOgre} owner
   */
  constructor(owner) {
    this.owner = owner;
    this.index = -1;
    this.elapsed = 0;
    this.samples = [];
    this.results = [];
  }

  start() {
    this.index = -1;
    this.results = [];
    this.#next();
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    if (this.index < 0 || this.index >= pitcherClips.length) {
      return;
    }
    this.elapsed += dt;
    const clip = pitcherClips[this.index];
    if (this.samples.length < 3 && this.elapsed >= clip.duration * [0.1, 0.5, 0.9][this.samples.length]) {
      this.samples.push(this.#sample());
    }
    if (this.elapsed > clip.duration + 0.15) {
      this.results.push({
        clip: clip.name,
        samples: this.samples,
      });
      this.#next();
    }
  }

  #next() {
    this.index++;
    this.elapsed = 0;
    this.samples = [];
    if (this.index >= pitcherClips.length) {
      this.owner.testPlaybackEvidence = this.results;
      console.info("PitcherOgrePlaybackEvidence", JSON.stringify(this.results));

      return;
    }
    this.owner.testPlayClip(pitcherClips[this.index].name);
  }

  /**
   * @returns {{time: number, speed: number, joints: Array<{name: string, position: number[], rotation: number[]}>}}
   */
  #sample() {
    const model = this.owner.model;
    const joints = [];
    for (const name of ["fist.L", "fist.R", "forearm.L", "forearm.R", "head", "foot.L", "hips", "chest"]) {
      const bone = model.findByName(name);
      const position = bone.getLocalPosition();
      const rotation = bone.getLocalRotation();
      joints.push({
        name,
        position: [position.x, position.y, position.z],
        rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
      });
    }

    return {
      time: model.anim.baseLayer.activeStateCurrentTime,
      speed: model.anim.speed,
      joints,
    };
  }
}
