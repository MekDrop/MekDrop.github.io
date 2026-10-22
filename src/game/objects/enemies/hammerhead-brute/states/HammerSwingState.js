import { State } from "yuka";

export class HammerSwingState extends State {
  /**
   * @param {import("../HammerheadBrute.js").HammerheadBrute} owner
   */
  enter(owner) {
    owner.phaseTime = 0;
    owner.playClip("hammer_swing");
    this.contacted = false;
  }

  /**
   * @param {import("../HammerheadBrute.js").HammerheadBrute} owner
   */
  execute(owner) {
    if (!this.contacted && owner.phaseTime >= 0.18) {
      this.contacted = true;
      owner.strike();
    }
    if (owner.phaseTime >= 0.45) {
      owner.transition("HammerRecoverState");
    }
  }
}

