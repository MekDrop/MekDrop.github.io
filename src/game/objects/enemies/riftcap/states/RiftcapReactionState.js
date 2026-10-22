import { State } from "yuka";
import { RiftcapPursueState } from "./RiftcapPursueState.js";

/**
 * External status reactions interrupt rather than resume a stale cast.
 */
export class RiftcapReactionState extends State {
  /**
   * @param {import("../Riftcap.js").Riftcap} owner
   */
  enter(owner) {
    this.elapsed = 0;
    owner.spells.collapseBubble();
    owner.pendingCast = null;
    owner.stop();
    owner.playClip("cast_interrupt");
  }

  /**
   * @param {import("../Riftcap.js").Riftcap} owner
   */
  execute(owner) {
    this.elapsed += owner.deltaTime;
    if (owner.statuses.has("knockback")) {
      owner.playClip("knockback");

      return;
    }
    owner.stop();
    if (this.elapsed < 0.2) {
      return;
    }
    const stunned = owner.statuses.has("stun");
    const confused = owner.statuses.has("confused");
    if (stunned || confused) {
      owner.playClip(stunned ? "stunned" : "confused");
      this.elapsed = 0.2;

      return;
    }
    owner.playClip("recover");
    if (this.elapsed >= 0.65) {
      owner.behavior.changeTo(RiftcapPursueState.name);
    }
  }
}
