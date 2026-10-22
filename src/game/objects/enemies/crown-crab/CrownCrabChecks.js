/**
 * Diagnostics invoked through the owning saved map's PlayCanvas HUD.
 */
export class CrownCrabChecks {
  /**
   * @param {import("./CrownCrab.js").CrownCrab} owner
   */
  constructor(owner) {
    this.owner = owner;
  }

  async verifyClips() {
    const owner = this.owner;
    const results = [];
    for (const [name, duration] of owner.animationPlayback.durations) {
      owner.testPlayClip(name);
      let elapsed = 0;
      const samples = [];
      while (elapsed < duration + 0.08 && owner.alive) {
        const dt = await new Promise(/**
         *
         * @param {(dt:number) => void} resolve
         */
          (resolve) => owner.app.once("postrender", () => resolve(owner.deltaTime)));
        elapsed += dt;
        const joints = ["Body", "Crown", "Claw.L", "Pincer.R", "ShinFront.L", "LegRear.R"].map(/**
         *
         * @param {string} name
         */
          (name) => {
            const bone = owner.modelRoot.findByName(name);
            const p = bone.getLocalPosition();
            const q = bone.getLocalRotation();

            return {
              name,
              position: [p.x, p.y, p.z],
              rotation: [q.x, q.y, q.z, q.w],
            };
          });
        samples.push({
          elapsed,
          ...owner.animationPlayback.status,
          joints,
        });
      }
      results.push({
        name,
        duration,
        samples,
      });
      owner.checkStatus = `Sampled ${results.length}/22 clips`;
    }
    owner.testPlayClip("idle");
    const content = {
      source: "production PlayCanvas GameModelLibrary instance",
      results,
    };
    console.info("CROWN_CRAB_PLAYBACK_COMPLETE", JSON.stringify(results.map(/**
     *
     * @param {{name:string,samples:Array}} r
     */
      (r) => ({
        name: r.name,
        samples: r.samples.length,
      }))));
    const link = document.createElement("a");
    document.getElementById("crown-crab-playback-download")?.remove();
    link.id = "crown-crab-playback-download";
    link.hidden = true;
    link.download = "crown-crab-playback.json";
    link.href = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(content))}`;
    document.body.appendChild(link);
    link.click();

    return results.length;
  }
}
