import { State } from "yuka";
import { RiftcapCastState } from "./RiftcapCastState.js";

export class RiftcapWindupState extends State {
  /**
   * @param {import("../Riftcap.js").Riftcap} owner
   */
  enter(owner) {
    this.elapsed = 0;
    owner.stop();
    const spell = owner.pendingCast.name;
    owner.playClip(spell === "heal" ? "heal_start" : spell === "time_bubble" ? "time_bubble_start" : `${spell}_windup`);
  }

  /**
   * @param {import("../Riftcap.js").Riftcap} owner
   */
  execute(owner) {
    owner.stop();
    this.elapsed += owner.deltaTime;
    if (this.elapsed >= 0.45) {
      owner.behavior.changeTo(RiftcapCastState.name);
    }
  }
}
