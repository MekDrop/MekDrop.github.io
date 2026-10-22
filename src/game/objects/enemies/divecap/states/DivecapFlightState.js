import { State } from "yuka";

/**
 * Ammo owns flight. Embedded clips own the headfirst pose.
 */
export class DivecapFlightState extends State {
  /**
   * @param {import("../Divecap.js").Divecap} owner
   */
  enter(owner) {
    owner.phaseStarted = owner.elapsed;
    owner.playClip("launch", true);
  }

  /**
   * @param {import("../Divecap.js").Divecap} owner
   */
  execute(owner) {
    const age = owner.elapsed - owner.phaseStarted;
    if (!owner.airborne) {
      return;
    }
    if (age > 0.3 && owner.entity.rigidbody?.linearVelocity.y > 0.1) {
      owner.playClip("airborne_fly");
    } else if (age > 0.3 && !["dive_pose", "dive_loop"].includes(owner.requestedAnimation)) {
      owner.playClip("dive_pose", true);
      owner.diveStarted = owner.elapsed;
    } else if (owner.requestedAnimation === "dive_pose" && owner.elapsed - owner.diveStarted >= 1 / 3) {
      owner.playClip("dive_loop");
    }
  }
}
