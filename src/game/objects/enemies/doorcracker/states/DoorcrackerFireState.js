import { State } from "yuka";

/**
 * Fire ignition continues during carry/flight; Ammo still owns its trajectory.
 */
export class DoorcrackerFireState extends State {
  /**
   * @param {import("../Doorcracker.js").Doorcracker} owner
   */
  enter(owner) {
    owner.stateTime = 0;
    owner.stop();
    owner.playClip("panic_fire", true);
  }

  /**
   * @param {import("../Doorcracker.js").Doorcracker} owner
   */
  execute(owner) {
    owner.stateTime += owner.deltaTime;
    if (owner.stateTime >= owner.fireIgnitionDuration) {
      owner.changeState("DoorcrackerDetonateState");
    }
  }
}
