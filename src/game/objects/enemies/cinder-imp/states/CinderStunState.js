import { State } from "yuka";

/**
 * Cinder Imp's Stun behavior.
 */
export class CinderStunState extends State {
  /**
   * @param {import("../CinderImp.js").CinderImp} owner
   */
  enter(owner) {
    owner.stop();
    owner.phaseTime = 0;
    owner.playClip("stun");
  }
  /**
   * @param {import("../CinderImp.js").CinderImp} owner
   */
  execute(owner) {
    if (owner.statuses.has("stun")) {
      return;
    }
    owner.transition("CinderStunRecoverState");
  }

}
