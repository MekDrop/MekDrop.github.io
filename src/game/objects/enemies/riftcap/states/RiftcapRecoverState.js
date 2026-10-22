import { State } from "yuka";
import { RiftcapPursueState } from "./RiftcapPursueState.js";

export class RiftcapRecoverState extends State {
  /**
   * @param {import("../Riftcap.js").Riftcap} owner
   */
  enter(owner) {
    this.elapsed = 0;
    const spell = owner.pendingCast?.name;
    owner.playClip(spell === "heal" ? "heal_end" : spell === "time_bubble" ? "time_bubble_end" : `${spell}_recover`);
  }

  /**
   * @param {import("../Riftcap.js").Riftcap} owner
   */
  execute(owner) {
    owner.stop();
    this.elapsed += owner.deltaTime;
    if (this.elapsed >= 0.4) {
      owner.behavior.changeTo(RiftcapPursueState.name);
    }
  }
}
