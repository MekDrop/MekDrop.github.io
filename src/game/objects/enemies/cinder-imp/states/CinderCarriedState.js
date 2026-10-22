import { State } from "yuka";

/**
 * Cinder Imp's Carried behavior.
 */
export class CinderCarriedState extends State {
  /**
   * @param {import("../CinderImp.js").CinderImp} owner
   */
  enter(owner) {
    owner.phaseTime = 0;
    owner.playClip("carried_struggle");
  }
  /**
   * @param {import("../CinderImp.js").CinderImp} owner
   */
  execute(owner) {
    owner.phaseTime += owner.deltaTime;
    owner.carrier?.receiveDamage?.(6 * owner.deltaTime, owner, "heat");
  }

}
