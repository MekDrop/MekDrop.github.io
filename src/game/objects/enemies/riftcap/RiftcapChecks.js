/**
 * Owns diagnostic actions invoked only by the saved map's PlayCanvas HUD.
 */
export class RiftcapChecks {
  /**
   * @param {import("./Riftcap.js").Riftcap} owner
   */
  constructor(owner) {
    this.owner = owner;
  }

  /**
   * Verify advancing Engine playback and changing bound joint poses for every clip.
   * @param {{download?:boolean}} options
   */
  async verifyClips({ download = true } = {}) {
    const owner = this.owner;
    const results = [];
    for (const [name, duration] of owner.clipDurations) {
      owner.testPlayClip(name);
      let elapsed = 0;
      const samples = [];
      while (elapsed < duration + 0.1) {
        const dt = await new Promise(/**
         *
         * @param {(dt:number) => void} resolve
         */
          (resolve) => owner.app.once("update", resolve));
        elapsed += dt;
        const joints = ["Root", "Hood", "Spine", "UpperArm.L", "Forearm.L", "Forearm.R", "Shin.L", "Foot.R", "OrbitCube"].map(/**
         *
         * @param {string} joint
         */
          (joint) => {
            const bone = owner.modelRoot.findByName(joint);
            const p = bone.getLocalPosition();
            const q = bone.getLocalRotation();

            return {
              name:joint,
              position:[p.x,p.y,p.z],
              rotation:[q.x,q.y,q.z,q.w],
            };
          });
        samples.push({
          elapsed,
          ...owner.animationStatus,
          joints,
        });
      }
      results.push({
        name,
        duration,
        samples,
      });
    }
    owner.testPlayClip("idle");
    const content = {
      source:"production PlayCanvas GameModelLibrary instance",
      results,
    };
    this.lastPlayback = content;
    console.info("RIFTCAP_PLAYBACK_COMPLETE", JSON.stringify(results.map(/**
     *
     * @param {{name:string,samples:Array}} row
     */
      (row) => ({
        name:row.name,
        samples:row.samples.length,
      }))));
    if (!download) {
      return content;
    }
    const link = document.createElement("a");
    link.download = "riftcap-playback.json";
    const url = URL.createObjectURL(new Blob([JSON.stringify(content)], {type:"application/json"}));
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return content;
  }
}

