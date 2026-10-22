import { State } from "yuka";

export class HammerRecoverState extends State {
  /**
   * @param {import("../HammerheadBrute.js").HammerheadBrute} owner
   */
  enter(owner) {
    owner.phaseTime = 0;
    owner.stop();
    owner.playClip("hammer_recover");
  }

  /**
   * @param {import("../HammerheadBrute.js").HammerheadBrute} owner
   */
  execute(owner) {
    if (owner.phaseTime >= 0.85) {
      owner.nextAttack = owner.elapsed + 0.35;
      owner.transition("HammerPursueState");
    }
  }
}

