import { State } from "yuka";

export class HammerStunState extends State {
  /**
   * @param {import("../HammerheadBrute.js").HammerheadBrute} owner
   */
  enter(owner) {
    owner.phaseTime = 0;
    owner.stop();
    owner.playClip("stun");
  }

  /**
   * @param {import("../HammerheadBrute.js").HammerheadBrute} owner
   */
  execute(owner) {
    if (!owner.statuses.has("stun")) {
      owner.transition("HammerStunRecoverState");
    }
  }
}

