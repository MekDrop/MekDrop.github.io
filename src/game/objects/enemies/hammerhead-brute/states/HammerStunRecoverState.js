import { State } from "yuka";

export class HammerStunRecoverState extends State {
  /**
   * @param {import("../HammerheadBrute.js").HammerheadBrute} owner
   */
  enter(owner) {
    owner.phaseTime = 0;
    owner.stop();
    owner.playClip("stun_recover");
  }

  /**
   * @param {import("../HammerheadBrute.js").HammerheadBrute} owner
   */
  execute(owner) {
    if (owner.phaseTime >= 0.65) {
      owner.transition("HammerPursueState");
    }
  }
}
