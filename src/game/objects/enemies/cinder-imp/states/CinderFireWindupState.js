import { State } from "yuka";

/**
 * Cinder Imp's FireWindup behavior.
 */
export class CinderFireWindupState extends State {
  /**
   * @param {import("../CinderImp.js").CinderImp} owner
   */
  enter(owner) {
    owner.stop();
    owner.faceTarget(owner.attackTarget);
    owner.phaseTime = 0;
    owner.playClip("fire_windup");
  }
  /**
   * @param {import("../CinderImp.js").CinderImp} owner
   */
  execute(owner) {
    owner.phaseTime += owner.deltaTime;
    if (owner.phaseTime >= 0.4) {
      owner.transition(owner.canReachWithFire(owner.attackTarget) ? "CinderFireLoopState" : "CinderFireRecoverState");
    }
  }

}
