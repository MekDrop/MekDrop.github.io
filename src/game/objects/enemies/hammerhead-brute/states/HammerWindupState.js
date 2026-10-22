import { State } from "yuka";

export class HammerWindupState extends State {
  /**
   * @param {import("../HammerheadBrute.js").HammerheadBrute} owner
   */
  enter(owner) {
    owner.phaseTime = 0;
    owner.stop();
    owner.playClip(typeof owner.attackTarget?.openTemporarily === "function" ? "overhead_door_bash" : "hammer_windup");
  }

  /**
   * @param {import("../HammerheadBrute.js").HammerheadBrute} owner
   */
  execute(owner) {
    if (owner.phaseTime >= 1.15) {
      owner.transition("HammerSwingState");
    }
  }
}

