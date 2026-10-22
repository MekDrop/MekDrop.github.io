import { State } from "yuka";

/**
 * A brief steam-producing clash has explicit windup, contact and recovery.
 */
export class CinderRivalAttackState extends State {
  /**
   * @param {import("../CinderImp.js").CinderImp} owner
   */
  enter(owner) {
    owner.stop();
    owner.faceTarget(owner.attackTarget);
    owner.phaseTime = 0;
    owner.playClip("rival_attack");
  }

  /**
   * @param {import("../CinderImp.js").CinderImp} owner
   */
  execute(owner) {
    const previous = owner.phaseTime;
    owner.phaseTime += owner.deltaTime;
    const contact = Math.max(0, Math.min(owner.phaseTime, 0.28) - Math.max(previous, 0.18));
    if (contact > 0) {
      owner.performFire(contact);
    }
    if (owner.phaseTime >= 0.65) {
      owner.transition("CinderFireRecoverState");
    }
  }
}
