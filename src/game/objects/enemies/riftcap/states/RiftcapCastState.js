import { State } from "yuka";
import { RiftcapRecoverState } from "./RiftcapRecoverState.js";

export class RiftcapCastState extends State {
  /**
   * @param {import("../Riftcap.js").Riftcap} owner
   */
  enter(owner) {
    this.elapsed = 0;
    this.plan = owner.pendingCast;
    owner.spells.cast(this.plan.name, this.plan.target);
    owner.playClip(this.plan.name === "heal" ? "heal_loop" :
      this.plan.name === "time_bubble" ? "time_bubble_sustain" : `${this.plan.name}_cast`);
  }

  /**
   * @param {import("../Riftcap.js").Riftcap} owner
   */
  execute(owner) {
    owner.stop();
    const duration = this.plan.name === "heal" ? 2.5 : this.plan.name === "time_bubble" ? 5 : 0.18;
    const dt = Math.min(owner.deltaTime, Math.max(0, duration - this.elapsed));
    this.elapsed += owner.deltaTime;
    if (this.plan.name === "heal") {
      owner.spells.heal(dt);
    }
    if (this.elapsed >= duration) {
      owner.behavior.changeTo(RiftcapRecoverState.name);
    }
  }

  /**
   * @param {import("../Riftcap.js").Riftcap} owner
   */
  exit(owner) {
    if (this.plan?.name === "heal") {
      owner.spells.endMendingPresentation();
    }
    if (this.plan?.name === "time_bubble") {
      owner.spells.collapseBubble();
    }
  }
}
