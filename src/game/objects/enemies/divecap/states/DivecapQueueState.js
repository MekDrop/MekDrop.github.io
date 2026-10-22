import { State } from "yuka";

/**
 * Stable id order forms a queue; the Pitcher Ogre owns actual pickup.
 */
export class DivecapQueueState extends State {
  /**
   * @param {import("../Divecap.js").Divecap} owner
   */
  enter(owner) {
    owner.playClip("volunteer_wave", true);
    owner.phaseStarted = owner.elapsed;
  }

  /**
   * @param {import("../Divecap.js").Divecap} owner
   */
  execute(owner) {
    const pitcher = owner.nearestPitcher;
    if (!pitcher || (owner.hasOpenRoyalEntrance && owner.elapsed >= owner.encouragedUntil)) {
      owner.changeState("DivecapPursueState");

      return;
    }
    const position = owner.queuePosition(pitcher);
    if (owner.position.distance(position) > 0.24) {
      owner.walkTo({ position });
    } else {
      owner.stop();
      if (owner.elapsed - owner.phaseStarted >= 1) {
        owner.playClip("queue_wait");
      }
    }
  }
}
