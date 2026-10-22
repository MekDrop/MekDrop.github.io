import { State } from "yuka";

export class DoorcrackerDeathState extends State {
  /**
   * @param {import("../Doorcracker.js").Doorcracker} owner
   */
  enter(owner) {
    owner.stateTime = 0;
    owner.stop();
    owner.disableContact();
    owner.playClip("death", true);
  }

  /**
   * @param {import("../Doorcracker.js").Doorcracker} owner
   */
  execute(owner) {
    owner.stateTime += owner.deltaTime;
    if (owner.stateTime >= owner.clipDuration("death")) {
      owner.destroy();
    }
  }
}
