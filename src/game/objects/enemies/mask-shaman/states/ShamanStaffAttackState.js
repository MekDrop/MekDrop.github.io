import { State } from "yuka";

/**
 * One contact per swing; interruptions cancel contact and discipline.
 */
export class ShamanStaffAttackState extends State {
  /**
   * @param {import("../MaskShaman.js").MaskShaman} owner
   */
  enter(owner) {
    owner.stateTime = 0;
    owner.attackTarget = owner.resolveRoyalTarget();
    owner.requestClip("staff_attack");
    owner.stop();
  }

  /**
   * @param {import("../MaskShaman.js").MaskShaman} owner
   */
  execute(owner) {
    if (owner.reconcileReaction()) {
      return;
    }
    const previous = owner.stateTime;
    owner.stateTime += owner.deltaTime;
    if (previous < 0.4 && owner.stateTime >= 0.4) {
      const target = owner.attackTarget;
      if (target && target.alive !== false && owner.distanceTo(target) <= owner.attackReach) {
        if (typeof target.receiveDamage === "function") {
          target.receiveDamage(8, owner, "staff");
        } else {
          target.beginGameOver?.();
        }
      }
    }
    if (owner.stateTime >= 1.1) {
      owner.beginCast();
    }
  }

  /**
   * @param {import("../MaskShaman.js").MaskShaman} owner
   */
  exit(owner) {
    owner.attackTarget = null;
  }
}
