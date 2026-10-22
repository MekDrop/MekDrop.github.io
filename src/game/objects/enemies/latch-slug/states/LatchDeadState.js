import { LATCH_SLUG_ANIMATION as ANIMATION } from "../LatchSlugAnimation.js";
import { State } from "yuka";

export class LatchDeadState extends State {
  /**
   * @param {import("../LatchSlug.js").LatchSlug} owner
   */
  enter(owner) {
    owner.stateAge = 0;
    owner.stop();
    owner.playClip(owner.residue ? ANIMATION.TERMINAL_SPLAT : ANIMATION.DEATH);
    // No living body survives a fatal splat. Residue owns only a bounded effect.
    if (owner.entity.rigidbody) {
      owner.entity.rigidbody.enabled = false;
    }
    for (const collision of owner.entity.findComponents("collision")) {
      collision.enabled = false;
    }
  }
}
