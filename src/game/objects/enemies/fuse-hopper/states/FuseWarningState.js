import { State } from "yuka";

/**
 * The fuse clock lives on the actor and survives every state interruption.
 */
export class FuseWarningState extends State {
  /**
   * @param {import("../FuseHopper.js").FuseHopper} owner
   */
  enter(owner) {
    owner.stop();
    owner.playClip("fuse_start");
  }

  /**
   * @param {import("../FuseHopper.js").FuseHopper} owner
   */
  execute(owner) {
    owner.stop();
    if (owner.fuseRemaining < owner.fuseDuration - 0.2) {
      owner.playClip("fuse_loop");
    }
  }
}
