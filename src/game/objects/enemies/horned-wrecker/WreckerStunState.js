import { State } from "yuka";

/**
 * External physical stun only; bells never enter this state.
 */
export class WreckerStunState extends State {
  /**
   * @param {import("./HornedWrecker.js").HornedWrecker} owner
   */
  enter(owner) {
    owner.stop();
    owner.playClip("external_stun");
  }

  /**
   * @param {import("./HornedWrecker.js").HornedWrecker} owner
   */
  execute(owner) {
    owner.stop();
    if (!owner.statuses.has("stun")) {
      owner.advanceAction(this.constructor);
    }
  }
}
