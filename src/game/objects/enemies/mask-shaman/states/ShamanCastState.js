import { State } from "yuka";

/**
 * Staff windup precedes any discipline effect.
 */
export class ShamanCastState extends State {
  /**
   * @param {import("../MaskShaman.js").MaskShaman} owner
   */
  enter(owner) {
    owner.stateTime = 0;
    owner.aura.active = false;
    owner.requestClip("staff_raise");
    owner.stop();
  }

  /**
   * @param {import("../MaskShaman.js").MaskShaman} owner
   */
  execute(owner) {
    if (owner.reconcileReaction()) {
      return;
    }
    owner.stateTime += owner.deltaTime;
    if (owner.stateTime >= 0.35) {
      owner.requestClip("discipline_cast");
    }
    if (owner.stateTime >= 0.85) {
      owner.resumeMarch();
    }
  }
}
