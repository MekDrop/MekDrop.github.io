import { State } from "yuka";

/**
 * Cinder Imp's FireRecover behavior.
 */
export class CinderFireRecoverState extends State {
  /**
   * @param {import("../CinderImp.js").CinderImp} owner
   */
  enter(owner) {
    owner.phaseTime = 0;
    owner.nextFire = owner.elapsed + owner.attackCooldown;
    owner.playClip("fire_recover");
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
