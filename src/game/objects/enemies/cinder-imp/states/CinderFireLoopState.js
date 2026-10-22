import { State } from "yuka";

/**
 * Cinder Imp's FireLoop behavior.
 */
export class CinderFireLoopState extends State {
  /**
   * @param {import("../CinderImp.js").CinderImp} owner
   */
  enter(owner) {
    owner.phaseTime = 0;
    owner.playClip("fire_loop");
    if (owner.canReachWithFire(owner.attackTarget)) {
      const point = owner.targetPosition(owner.attackTarget);
      owner.addHotPatch(new owner.pc.Vec3(point.x, owner.position.y, point.z));
    }
  }
  /**
   * @param {import("../CinderImp.js").CinderImp} owner
   */
  execute(owner) {
    const step = Math.min(owner.deltaTime, Math.max(0, 0.65 - owner.phaseTime));
    owner.performFire(step);
    if (owner.behavior.currentState !== this) {
      return;
    }
    owner.phaseTime += owner.deltaTime;
    if (owner.phaseTime >= 0.65 || owner.attackTarget?.alive === false) {
      owner.transition("CinderFireRecoverState");
    }
  }

}
