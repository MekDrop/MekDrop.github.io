import { State } from "yuka";

/**
 * Bell and external stun pause pursuit, never the fuse.
 */
export class FuseStoppedState extends State {
  /**
   * @param {import("../FuseHopper.js").FuseHopper} owner
   */
  enter(owner) {
    owner.stop();
    owner.playClip(owner.statuses.has("stun") ? "stun" : "startled_stop");
  }

  /**
   * @param {import("../FuseHopper.js").FuseHopper} owner
   */
  execute(owner) {
    owner.stop();
    if (!owner.statuses.has("stun") && !owner.statuses.has("confused")) {
      owner.react("recover", 0.27);
    }
  }
}
