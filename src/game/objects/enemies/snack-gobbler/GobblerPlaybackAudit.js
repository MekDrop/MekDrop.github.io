import { gobblerClips } from "./GobblerClips.js";

/**
 * Records real Engine joint motion, not merely advancing clip names.
 */
export class GobblerPlaybackAudit {
  /**
   * @param {import("./SnackGobbler.js").SnackGobbler} owner
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
    if (this.index < 0 || this.index >= gobblerClips.length) {
      return;
    }
    this.elapsed += dt;
    const clip = gobblerClips[this.index];
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
    if (this.index >= gobblerClips.length) {
      this.owner.testPlaybackEvidence = this.results;
      console.info("SnackGobblerPlaybackEvidence", JSON.stringify(this.results));
      const link = document.createElement("a");
      link.download = "snack-gobbler-playback.json";
      link.href = URL.createObjectURL(new Blob([JSON.stringify(this.results, null, 2)], { type: "application/json" }));
      link.click();
      URL.revokeObjectURL(link.href);

      return;
    }
    this.owner.testPlayClip(gobblerClips[this.index].name);
  }

  /**
   * @returns {{time: number, speed: number, joints: Array<{name: string, position: number[], rotation: number[]}>}}
   */
  #sample() {
    const model = this.owner.model;
    const joints = [];
    for (const name of ["body", "jaw", "tongue", "tongue_tip", "arm_L", "foot_L", "eye_L"]) {
      const bone = model.findByName(name);
      const position = bone.getLocalPosition();
      const rotation = bone.getLocalRotation();
      const scale = bone.getLocalScale();
      joints.push({
        name,
        position: [position.x, position.y, position.z],
        rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
        scale: [scale.x, scale.y, scale.z],
      });
    }

    return {
      time: model.anim.baseLayer.activeStateCurrentTime,
      speed: model.anim.speed,
      joints,
    };
  }
}
