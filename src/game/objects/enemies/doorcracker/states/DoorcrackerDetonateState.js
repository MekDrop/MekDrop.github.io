import { State } from "yuka";

/**
 * The manifest contact event commits one terminal blast, independent of render FPS.
 */
export class DoorcrackerDetonateState extends State {
  /**
   * @param {import("../Doorcracker.js").Doorcracker} owner
   */
  enter(owner) {
    owner.stop();
    owner.stateTime = 0;
    owner.playClip("detonate", true);
  }

  /**
   * @param {import("../Doorcracker.js").Doorcracker} owner
   */
  execute(owner) {
    owner.stateTime += owner.deltaTime;
    if (owner.stateTime >= owner.detonationTime) {
      owner.commitBlast();
    }
    if (owner.stateTime >= owner.clipDuration("detonate")) {
      owner.destroy();
    }
  }
}
