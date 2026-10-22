import { State } from "yuka";

/**
 * Pursue the person; accessible doors take priority over the throwing queue.
 */
export class DivecapPursueState extends State {
  /**
   * @param {import("../Divecap.js").Divecap} owner
   */
  enter(owner) {
    owner.playClip("walk");
  }

  /**
   * @param {import("../Divecap.js").Divecap} owner
   */
  execute(owner) {
    const royal = owner.resolveRoyalTarget();
    if (owner.canBonk(royal)) {
      owner.changeState("DivecapBonkState");

      return;
    }
    if (!owner.hasOpenRoyalEntrance && owner.nearestPitcher) {
      owner.changeState("DivecapQueueState");

      return;
    }
    if (royal) {
      owner.walkTo(royal);
    } else {
      owner.stop();
      owner.playClip("idle");
    }
  }
}
