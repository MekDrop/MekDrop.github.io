import { State } from "yuka";

/**
 * Ammo owns airborne movement; passengers retain their armed fuse.
 */
export class FusePassengerState extends State {
  /**
   * @param {import("../FuseHopper.js").FuseHopper} owner
   */
  enter(owner) {
    owner.playClip(owner.carrier ? "carried_ready" : "thrown_tumble");
  }

  /**
   * @param {import("../FuseHopper.js").FuseHopper} owner
   */
  execute(owner) {
    if (!owner.carrier && !owner.airborne) {
      owner.resumeTask();
    }
  }
}
