import { State } from "yuka";

/**
 * Complete the authored climb crest while Ammo retains the attachment.
 */
export class GremlinClimbTopState extends State {
  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  enter(owner) {
    owner.stateElapsed = 0;
    owner.stop();
    owner.playAnimation("climb_top");
  }

  /**
   * @param {import("../WireGremlin.js").WireGremlin} owner
   */
  execute(owner) {
    if (owner.stateElapsed >= 0.7) {
      owner.changeState("GremlinAttachState");
    }
  }
}
