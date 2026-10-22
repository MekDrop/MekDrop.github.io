import { State } from "yuka";

/**
 * Recovery begins after the external stun expires, with its own playback time.
 */
export class CinderStunRecoverState extends State {
  /**
   * @param {import("../CinderImp.js").CinderImp} owner
   */
  enter(owner) {
    owner.phaseTime = 0;
    owner.playClip("stun_recover");
  }

  /**
   * @param {import("../CinderImp.js").CinderImp} owner
   */
  execute(owner) {
    owner.phaseTime += owner.deltaTime;
    if (owner.phaseTime >= 0.35) {
      owner.transition("CinderPursueState");
    }
  }
}
