import { State } from "yuka";

/**
 * Discipline accompanies pursuit of the actual royal actor.
 */
export class ShamanMarchState extends State {
  /**
   * @param {import("../MaskShaman.js").MaskShaman} owner
   */
  enter(owner) {
    owner.aura.active = true;
    owner.requestClip("aura_sustain");
  }

  /**
   * @param {import("../MaskShaman.js").MaskShaman} owner
   */
  execute(owner) {
    if (owner.reconcileReaction()) {
      return;
    }
    const royal = owner.resolveRoyalTarget();
    if (!royal) {
      owner.stop();
      owner.requestClip("aura_sustain");

      return;
    }
    if (owner.distanceTo(royal) <= owner.attackReach) {
      owner.beginStaffAttack();

      return;
    }
    owner.requestClip("walk");
    owner.moveToward(royal, owner.walkSpeed);
  }

  /**
   * @param {import("../MaskShaman.js").MaskShaman} owner
   */
  exit(owner) {
    owner.aura.active = false;
  }
}
