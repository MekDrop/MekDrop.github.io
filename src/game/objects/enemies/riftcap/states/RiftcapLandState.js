import { State } from "yuka";
import { RiftcapPursueState } from "./RiftcapPursueState.js";
import { RiftcapReactionState } from "./RiftcapReactionState.js";

export class RiftcapLandState extends State {
  /**
   * @param {import("../Riftcap.js").Riftcap} owner
   */
  enter(owner) {
    this.elapsed = 0;
    owner.playClip("land");
  }

  /**
   * @param {import("../Riftcap.js").Riftcap} owner
   */
  execute(owner) {
    owner.stop();
    this.elapsed += owner.deltaTime;
    if (this.elapsed >= 0.45) {
      owner.behavior.changeTo(owner.statuses.has("confused") || owner.statuses.has("stun") ?
        RiftcapReactionState.name : RiftcapPursueState.name);
    }
  }
}
