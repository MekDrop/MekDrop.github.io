import { State } from "yuka";
import { RiftcapWindupState } from "./RiftcapWindupState.js";

export class RiftcapPursueState extends State {
  /**
   * @param {import("../Riftcap.js").Riftcap} owner
   */
  enter(owner) {
    owner.playClip("walk");
    owner.pendingCast = null;
  }

  /**
   * @param {import("../Riftcap.js").Riftcap} owner
   */
  execute(owner) {
    if (owner.testPaused) {
      owner.stop();
      owner.playClip("idle");

      return;
    }
    const plan = owner.chooseSpell();
    if (plan) {
      owner.pendingCast = plan;
      owner.behavior.changeTo(RiftcapWindupState.name);

      return;
    }
    const target = owner.resolveRoyalTarget();
    const moving = target && owner.moveToward(target, 1.1);
    if (!moving) {
      owner.stop();
    }
    owner.playClip(moving ? "walk" : "idle");
  }
}
