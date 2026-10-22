import { State } from "yuka";

/**
 * Confusion, stun, carrying and flight all suspend concentration.
 */
export class ShamanInterruptedState extends State {
  /**
   * @param {import("../MaskShaman.js").MaskShaman} owner
   */
  enter(owner) {
    owner.aura.active = false;
    owner.requestClip("cast_interrupt");
  }

  /**
   * @param {import("../MaskShaman.js").MaskShaman} owner
   */
  execute(owner) {
    if (!owner.alive) {
      owner.beginDeath();

      return;
    }
    const reason = owner.reactionReason;
    if (!reason) {
      owner.beginRecovery();

      return;
    }
    owner.requestClip(reason);
    owner.stop();
  }
}
