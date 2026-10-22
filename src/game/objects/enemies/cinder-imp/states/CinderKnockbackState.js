import { State } from "yuka";

/**
 * External impacts retain the engine's impulse while the authored reaction plays.
 */
export class CinderKnockbackState extends State {
  /**
   * @param {import("../CinderImp.js").CinderImp} owner
   */
  enter(owner) {
    owner.phaseTime = 0;
    owner.playClip("knockback");
  }
  /**
   * @param {import("../CinderImp.js").CinderImp} owner
   */
  execute(owner) {
    owner.phaseTime += owner.deltaTime;
    if (owner.phaseTime >= 0.4) {
      owner.transition("CinderPursueState");
    }
  }
}
