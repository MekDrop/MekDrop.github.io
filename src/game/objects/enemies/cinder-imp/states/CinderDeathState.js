import { State } from "yuka";

/**
 * Cinder Imp's Death behavior.
 */
export class CinderDeathState extends State {
  /**
   * @param {import("../CinderImp.js").CinderImp} owner
   */
  enter(owner) {
    owner.stop();
    owner.phaseTime = 0;
    owner.playClip("death");
    if (owner.entity.rigidbody) {
      owner.entity.rigidbody.enabled = false;
    }
  }
  /**
   * @param {import("../CinderImp.js").CinderImp} owner
   */
  execute(owner) {
    owner.phaseTime += owner.deltaTime;
    if (owner.phaseTime >= 1.2) {
      owner.destroy();
    }
  }

}
