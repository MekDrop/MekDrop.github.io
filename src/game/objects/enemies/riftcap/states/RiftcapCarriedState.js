import { State } from "yuka";
import { RiftcapPursueState } from "./RiftcapPursueState.js";

export class RiftcapCarriedState extends State {
  /**
   * @param {import("../Riftcap.js").Riftcap} owner
   */
  enter(owner) {
    this.elapsed = 0;
    owner.spells.collapseBubble();
    owner.playClip("carried_struggle");
  }

  /**
   * @param {import("../Riftcap.js").Riftcap} owner
   */
  execute(owner) {
    this.elapsed += owner.deltaTime;
    if (this.elapsed < 0.35 || owner.statuses.has("confused") || owner.statuses.has("stun") || !owner.spells.ready("swap")) {
      return;
    }
    for (const ally of owner.spells.allies()) {
      if (owner.spells.canSwap(ally)) {
        owner.spells.cast("swap", ally);
        owner.behavior.changeTo(RiftcapPursueState.name);

        return;
      }
    }
  }
}
