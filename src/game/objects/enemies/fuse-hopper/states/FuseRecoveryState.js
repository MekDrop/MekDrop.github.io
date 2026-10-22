import { State } from "yuka";
/**
 * Authored reaction phase with an explicit deadline.
 */
export class FuseRecoveryState extends State {
  /**
   * @param {import("../FuseHopper.js").FuseHopper} owner
   */
  enter(owner) {
    owner.stop();
    owner.playClip(owner.reactionClip);
    owner.reactionUntil = owner.elapsed + owner.reactionDuration;
  }
  /**
   * @param {import("../FuseHopper.js").FuseHopper} owner
   */
  execute(owner) {
    owner.stop();
    if (owner.elapsed >= owner.reactionUntil) {
      owner.resumeTask();
    }
  }
}
