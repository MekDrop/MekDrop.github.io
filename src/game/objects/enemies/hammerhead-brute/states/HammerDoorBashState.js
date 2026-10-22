import { State } from "yuka";

export class HammerDoorBashState extends State {
  /**
   * @param {import("../HammerheadBrute.js").HammerheadBrute} owner
   */
  enter(owner) {
    owner.phaseTime = 0;
    this.contacted = false;
    owner.stop();
    owner.playClip("overhead_door_bash");
  }

  /**
   * @param {import("../HammerheadBrute.js").HammerheadBrute} owner
   */
  execute(owner) {
    if (!this.contacted && owner.phaseTime >= 1.15) {
      this.contacted = true;
      owner.strike();
    }
    if (owner.phaseTime >= 1.6) {
      owner.nextAttack = owner.elapsed + 0.35;
      owner.transition("HammerPursueState");
    }
  }
}
