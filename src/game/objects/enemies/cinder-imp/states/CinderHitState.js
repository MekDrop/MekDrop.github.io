import { State } from "yuka";

/**
 * Damage interrupts attack windup and cancels unspent fire contact.
 */
export class CinderHitState extends State {
  /**
   * @param {import("../CinderImp.js").CinderImp} owner
   */
  enter(owner) {
    owner.stop();
    owner.phaseTime = 0;
    owner.playClip("hit");
  }

  /**
   * @param {import("../CinderImp.js").CinderImp} owner
   */
  execute(owner) {
    owner.phaseTime += owner.deltaTime;
    if (owner.phaseTime >= 0.3) {
      owner.transition("CinderPursueState");
    }
  }
}
