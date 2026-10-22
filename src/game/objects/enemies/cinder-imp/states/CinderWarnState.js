import { State } from "yuka";

/**
 * Cinder Imp's Warn behavior.
 */
export class CinderWarnState extends State {
  /**
   * @param {import("../CinderImp.js").CinderImp} owner
   */
  enter(owner) {
    owner.stop();
    owner.phaseTime = 0;
    owner.playClip("angry_warn");
  }
  /**
   * @param {import("../CinderImp.js").CinderImp} owner
   */
  execute(owner) {
    owner.phaseTime += owner.deltaTime;
    if (owner.phaseTime >= 0.45) {
      owner.transition("CinderPursueState");
    }
  }

}
