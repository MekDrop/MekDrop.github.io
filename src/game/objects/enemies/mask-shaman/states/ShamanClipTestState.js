import { State } from "yuka";

/**
 * Explicit map-authored playback inspection, separate from gameplay decisions.
 */
export class ShamanClipTestState extends State {
  /**
   * @param {import("../MaskShaman.js").MaskShaman} owner
   */
  enter(owner) {
    owner.aura.active = false;
    owner.stop();
  }

  /**
   * @param {import("../MaskShaman.js").MaskShaman} owner
   */
  execute(owner) {
    owner.reconcileReaction();
  }
}
