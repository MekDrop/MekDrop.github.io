/**
 * Owns diagnostic actions invoked only by the saved map's PlayCanvas HUD.
 */
export class HammerChecks {
  /**
   * @param {import("./HammerheadBrute.js").HammerheadBrute} owner
   */
  constructor(owner) {
    this.owner = owner;
  }

  /**
   * Inspect real update/Ammo state from a saved test-map HUD action.
   * @param {string} mode
   */
  async verifyBehavior(mode) {
    const owner = this.owner;
    const rows = [];
    /**
     * @param {string} label
     */
    const snapshot = (label) => {
      const p = owner.position;
      const royal = owner.resolveRoyalTarget();
      const target = owner.targetPosition(royal);
      const row = {
        label,
        state: owner.stateName,
        health: owner.health,
        wallTimeMs: performance.now(),
        position: [p.x, p.y, p.z],
        royal: target ? [target.x, target.y, target.z] : null,
        target: owner.attackTarget?.definition?.id ?? owner.attackTarget?.constructor.name,
        parented: !!owner.entity.parent,
        rigidbody: owner.entity.rigidbody?.enabled ?? false,
        clip: owner.entity.parent ? owner.playback?.status : null,
        statuses: [...owner.statuses.keys()],
        doors: owner.actors.flatMap(/**
         *
         * @param {import("../shared/Enemy.js").EnemyActor} actor
         */
          actor => [...(actor.entranceDoors ?? [])].map(/**
         *
         * @param {import("../../architecture/door/Door.js").Door} door
         */
            door => ({
              health: door.health,
              broken: door.broken,
              openAmount: door.openAmount,
              position: [...door.entity.getPosition().toArray()],
            }))),
      };
      rows.push(row);
      console.info("HAMMERHEAD_BEHAVIOR_SAMPLE", JSON.stringify(row));
    };
    /**
     * @param {number} seconds
     */
    const wait = async (seconds) => {
      let elapsed = 0;
      while (elapsed < seconds) {
        elapsed += await new Promise(/**
         *
         * @param {(dt:number)=>void} resolve
         */
          resolve => owner.app.once("update", resolve));
      }
    };
    snapshot("initial");
    if (mode === "siege") {
      for (const actor of owner.actors) {
        if (actor.entranceDoors) {
          actor.testEntranceOpenAmount = 0;
        }
      }
      owner.resumeBehavior();
      for (let second = 1; second <= 30; second++) {
        await wait(1);
        snapshot(`siege-${second}`);
      }
      owner.testPlayClip("idle");
    } else {
      owner.testPlayClip("idle");
      const bell = owner.onBellRung({ eventId: Date.now() });
      snapshot(`bell-return-${bell}`);
      const carry = owner.beginCarry(owner.resolveRoyalTarget());
      const launch = owner.launch({
        velocity: {
          x: 0,
          y: 4,
          z: 0,
        },
      });
      snapshot(`carry-${carry}-launch-${launch}`);
      await wait(1);
      owner.applyStatus("stun", { duration: 1 });
      snapshot("stunned");
      await wait(1.1);
      snapshot("stun-recovery");
      await wait(1);
      snapshot("recovered");
      for (const scale of [0.5, 1]) {
        owner.app.timeScale = scale;
        owner.testPlayClip("heavy_walk");
        await wait(0.2);
        snapshot(`speed-${scale}-start`);
        await wait(0.4);
        snapshot(`speed-${scale}-end`);
      }
      owner.receiveDamage(10000);
      snapshot("death");
      await wait(2.5);
      snapshot("cleanup");
    }
    console.info("HAMMERHEAD_BEHAVIOR_COMPLETE", JSON.stringify({
      mode,
      rows,
    }));

    return rows;
  }

  /**
   * Verify advancing Engine playback and changing bound joint poses for every clip.
   */
  async verifyClips() {
    const owner = this.owner;
    const results = [];
    for (const [name, duration] of owner.playback.durations) {
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
        const joints = ["Root", "Chest", "Head", "UpperArm.L", "UpperArm.R", "Forearm.L", "Forearm.R", "Shin.L", "Foot.R"].map(/**
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
          ...owner.playback.status,
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
    console.info("HAMMERHEAD_PLAYBACK_COMPLETE", JSON.stringify(results.map(/**
     *
     * @param {{name:string,samples:Array}} row
     */
      (row) => ({
        name:row.name,
        samples:row.samples.length,
      }))));
    const link = document.createElement("a");
    link.download = "hammerhead-brute-playback.json";
    const url = URL.createObjectURL(new Blob([JSON.stringify(content)], {type:"application/json"}));
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return results.length;
  }
}

