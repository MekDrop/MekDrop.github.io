import { State } from "yuka";

export class DivecapBonkState extends State {
  /**
   * @param {import("../Divecap.js").Divecap} owner
   */
  enter(owner) {
    owner.phaseStarted = owner.elapsed;
    owner.attackTarget = owner.resolveRoyalTarget();
    owner.attackContactAt = owner.elapsed + 0.2;
    owner.stop();
    owner.playClip("helmet_bonk", true);
  }

  /**
   * @param {import("../Divecap.js").Divecap} owner
   */
  execute(owner) {
    if (owner.elapsed >= owner.attackContactAt) {
      owner.attackContactAt = Infinity;
      if (owner.attackTarget && owner.distanceTo(owner.attackTarget) < 1) {
        owner.strikeRoyal(owner.attackTarget, 8);
      }
    }
    if (owner.elapsed - owner.phaseStarted >= 0.7) {
      owner.changeState("DivecapPursueState");
    }
  }
}
