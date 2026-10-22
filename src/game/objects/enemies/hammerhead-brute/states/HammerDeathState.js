import { State } from "yuka";

export class HammerDeathState extends State {
  /**
   * @param {import("../HammerheadBrute.js").HammerheadBrute} owner
   */
  enter(owner) {
    owner.phaseTime = 0;
    owner.stop();
    owner.playClip("death");
    if (owner.entity.rigidbody) {
      owner.entity.rigidbody.enabled = false;
    }
  }

  /**
   * @param {import("../HammerheadBrute.js").HammerheadBrute} owner
   */
  execute(owner) {
    if (owner.phaseTime >= 2.2) {
      owner.destroy();
    }
  }
}

