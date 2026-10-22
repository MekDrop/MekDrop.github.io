import { State } from "yuka";

export class DoorcrackerBraceState extends State {
  /**
   * @param {import("../Doorcracker.js").Doorcracker} owner
   */
  enter(owner) {
    owner.stop();
    owner.stateTime = 0;
    owner.playClip("brace_door", true);
  }

  /**
   * @param {import("../Doorcracker.js").Doorcracker} owner
   */
  execute(owner) {
    if (!owner.hasFuseTarget) {
      owner.interruptFuse();

      return;
    }
    owner.stateTime += owner.deltaTime;
    if (owner.stateTime >= owner.clipDuration("brace_door")) {
      owner.changeState("DoorcrackerFuseState");
    }
  }
}
