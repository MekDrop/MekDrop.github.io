import { State } from "yuka";

/**
 * Cinder Imp's Land behavior.
 */
export class CinderLandState extends State {
  /**
   * @param {import("../CinderImp.js").CinderImp} owner
   */
  enter(owner) {
    owner.phaseTime = 0;
    owner.stop();
    owner.playClip("land");
  }
  /**
   * @param {import("../CinderImp.js").CinderImp} owner
   */
  execute(owner) {
    owner.phaseTime += owner.deltaTime;
    if (owner.phaseTime >= 0.2) {
      owner.playClip("land_recover");
    }
    if (owner.phaseTime >= 0.55) {
      owner.transition(owner.statuses.has("stun") ? "CinderStunState" : "CinderPursueState");
    }
  }

}
