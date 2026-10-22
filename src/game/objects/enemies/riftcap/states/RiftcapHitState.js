import { State } from "yuka";
import { RiftcapPursueState } from "./RiftcapPursueState.js";

export class RiftcapHitState extends State {
  /**
   * @param {import("../Riftcap.js").Riftcap} owner
   */
  enter(owner) {
    this.elapsed = 0;
    owner.stop();
    owner.playClip("hit");
  }

  /**
   * @param {import("../Riftcap.js").Riftcap} owner
   */
  execute(owner) {
    owner.stop();
    this.elapsed += owner.deltaTime;
    if (this.elapsed >= 0.3) {
      owner.behavior.changeTo(RiftcapPursueState.name);
    }
  }
}
