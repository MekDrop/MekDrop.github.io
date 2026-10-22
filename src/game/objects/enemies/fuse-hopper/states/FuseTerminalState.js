import { State } from "yuka";

/**
 * Terminal latch prevents repeated damage and chain-blast recursion.
 */
export class FuseTerminalState extends State {
  /**
   * @param {import("../FuseHopper.js").FuseHopper} owner
   */
  enter(owner) {
    owner.stop();
    owner.playClip(owner.exploded ? "detonate" : "death");
    owner.cleanupAt = owner.elapsed + 0.65;
    if (owner.entity.rigidbody) {
      owner.entity.rigidbody.enabled = false;
    }
  }

  /**
   * @param {import("../FuseHopper.js").FuseHopper} owner
   */
  execute(owner) {
    if (owner.elapsed >= owner.cleanupAt) {
      owner.destroy();
    }
  }
}
