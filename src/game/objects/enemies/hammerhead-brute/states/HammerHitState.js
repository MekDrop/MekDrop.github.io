import { State } from "yuka";

export class HammerHitState extends State {
  /**
   * @param {import("../HammerheadBrute.js").HammerheadBrute} owner
   */
  enter(owner) {
    owner.phaseTime = 0;
    owner.stop();
    owner.playClip("hit");
  }

  /**
   * @param {import("../HammerheadBrute.js").HammerheadBrute} owner
   */
  execute(owner) {
    if (owner.phaseTime >= 0.35) {
      owner.transition("HammerPursueState");
    }
  }
}
