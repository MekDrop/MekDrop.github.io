import { State } from "yuka";

/**
 * Recovery never restores an aura until a new cast completes.
 */
export class ShamanRecoverState extends State {
  /**
   * @param {import("../MaskShaman.js").MaskShaman} owner
   */
  enter(owner) {
    owner.stateTime = 0;
    owner.aura.active = false;
    owner.requestClip("recover");
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
    if (owner.stateTime >= 0.6) {
      owner.beginCast();
    }
  }
}
